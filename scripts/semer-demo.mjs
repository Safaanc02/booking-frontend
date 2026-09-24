/*
 * Peuple la base locale de quoi voir les trois tableaux de bord pleins.
 *
 * Les comptes de démonstration finissent par ne plus rien montrer : les
 * rendez-vous passent, les demandes se traitent, et l'écran qu'on voulait
 * essayer affiche « rien n'attend ». Ce script remet de la matière.
 *
 *   npm run semer:demo                       tout
 *   npm run semer:demo -- gerant             une seule partie
 *
 * Les parties : cliente, gerant, equipe.
 *
 * Tout passe par l'API, aux mêmes règles que n'importe quel utilisateur : les
 * créneaux sont choisis parmi ceux que le moteur de disponibilité propose
 * vraiment, et une saisie refusée est signalée plutôt que contournée.
 *
 * Une seule exception, et elle est assumée : l'API refuse — à raison — de
 * créer une réservation dans le passé. Pour obtenir une visite honorée qui
 * attend encore son avis, on réserve normalement, puis on recule les dates en
 * SQL. Affaiblir la règle côté serveur pour les besoins d'une démonstration
 * coûterait bien plus cher que ces trois lignes.
 *
 * Le script ajoute, il n'efface rien : le relancer empile une nouvelle
 * journée sur la précédente.
 *
 * Il vise le développement par défaut. Pour garnir la pile de partage :
 *
 *   API_URL=http://localhost:8090 KC_URL=http://localhost:8090/auth \
 *   PG_CONTENEUR=booking-partage-postgres-1 ENV_FICHIER=../../booking-backend/partage.env \
 *   npm run semer:demo
 *
 * `API_URL` est l'origine seule : les chemins portent déjà leur `/api`. L'y
 * remettre donnait `/api/api/...`, que le serveur refusait en 401 — un code
 * qui envoie chercher un problème d'authentification là où il n'y en a pas.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'

const execFileP = promisify(execFile)

const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'
/* Le conteneur Postgres visé. Le développement et la pile de partage ont
   chacun le leur, et se tromper de base est silencieux : le script annonce
   tout en vert sans que rien n'apparaisse à l'écran qu'on regarde. */
const PG = process.env.PG_CONTENEUR ?? 'booking-postgres'
const ZONE = 'Africa/Casablanca'

const COMPTES = {
  admin: [process.env.ADMIN_USER ?? 'admin@darzin.ma', process.env.ADMIN_PASS ?? 'admin'],
  pro: [process.env.PRO_USER ?? 'pro1@darzin.ma', process.env.PRO_PASS ?? 'pro1'],
  client: [process.env.CLIENT_USER ?? 'client1@darzin.ma', process.env.CLIENT_PASS ?? 'client1'],
}

let poses = 0
let refuses = 0
const dit = (ok, texte) => {
  if (ok) poses += 1; else refuses += 1
  console.log(' ', ok ? '✅' : '⚠️ ', texte)
}

/* ---------------------------------------------------------------- */
/* Outils                                                           */
/* ---------------------------------------------------------------- */

async function jeton([identifiant, motDePasse]) {
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', grant_type: 'password',
      username: identifiant, password: motDePasse,
    }),
  })
  if (!r.ok) throw new Error(`connexion refusée pour ${identifiant} (${r.status})`)
  return (await r.json()).access_token
}

async function appel(chemin, { jeton: t, methode = 'GET', corps } = {}) {
  const r = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  })
  const texte = await r.text()
  const donnees = texte ? JSON.parse(texte) : null
  if (!r.ok) {
    const e = new Error(donnees?.detail ?? donnees?.message ?? `${r.status} sur ${chemin}`)
    e.statut = r.status
    throw e
  }
  return donnees
}

/** La date à Casablanca, décalée de `jours`, au format AAAA-MM-JJ. */
const dateLocale = (jours = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + jours * 86_400_000))

/**
 * L'instant UTC correspondant à une heure locale de Casablanca, ce jour-là.
 *
 * Le Maroc est à UTC+1 sauf pendant le Ramadan : on ne le suppose pas, on le
 * mesure — minuit UTC, rendu dans le fuseau, donne le décalage du jour.
 *
 * L'heure lue est celle d'un fuseau en avance tant qu'elle ne dépasse pas
 * midi, et celle d'un fuseau en retard au-delà : minuit UTC se lit 01:00 à
 * Casablanca (+1) et 19:00 la veille à New York (−5). Une première version
 * écrivait `24 - lue` dans tous les cas, ce qui donne +23 pour Casablanca :
 * tous les rendez-vous semés tombaient quatorze heures trop tôt, et la
 * journée qu'on voulait garnir était déjà finie au moment de l'ouvrir.
 */
function instant(jours, heure, minute = 0) {
  const [a, m, j] = dateLocale(jours).split('-').map(Number)
  const minuitUtc = Date.UTC(a, m - 1, j, 0, 0, 0)
  const lue = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, hour: '2-digit', hour12: false,
  }).format(new Date(minuitUtc)))
  const decalage = lue <= 12 ? lue : lue - 24
  return new Date(minuitUtc + (heure - decalage) * 3_600_000 + minute * 60_000).toISOString()
}

/**
 * Une requête SQL sur la base visée, par son conteneur Postgres.
 *
 * Le mot de passe vient de l'environnement s'il y est, sinon du fichier de
 * configuration du serveur — le même que celui dont se sert l'API, pour
 * qu'il n'y ait pas deux endroits à tenir en accord.
 */
async function sql(requete) {
  let motDePasse = process.env.DB_PASSWORD
  if (!motDePasse) {
    const chemin = process.env.ENV_FICHIER ?? '../../booking-backend/.env'
    const env = readFileSync(new URL(chemin, import.meta.url), 'utf8')
    motDePasse = env.match(/^DB_PASSWORD=(.*)$/m)?.[1]?.trim()
  }
  if (!motDePasse) throw new Error('DB_PASSWORD introuvable — le passer en variable d\'environnement')
  const { stdout } = await execFileP('docker', [
    'exec', '-e', `PGPASSWORD=${motDePasse}`, PG,
    'psql', '-U', 'booking_user', '-d', 'beauty_booking', '-tAc', requete,
  ])
  return stdout.trim()
}

/* ---------------------------------------------------------------- */
/* La cliente                                                       */
/* ---------------------------------------------------------------- */

/**
 * Réserve au premier créneau libre, à partir d'un jour et d'une heure voulus.
 *
 * Passe par les disponibilités réelles plutôt que par une heure choisie
 * d'avance : le moteur tient compte des horaires, des congés et de ce qui est
 * déjà pris, et une heure devinée se fait refuser un jour sur deux.
 *
 * Et cherche le jour suivant si celui-là ne donne rien : un décalage fixe
 * tombe un dimanche une fois sur sept, et le salon est fermé. La première
 * version le prenait pour une panne et sautait la réservation.
 */
async function reserverPourLaCliente(t, { salonId, prestationId, jours, apres }, fenetre = 7) {
  for (let d = jours; d < jours + fenetre; d++) {
    const dispo = await appel(
      `/api/public/salons/${salonId}/disponibilites?prestationId=${prestationId}&date=${dateLocale(d)}`)
    const libre = (dispo.creneaux ?? []).find((c) => c.heure >= apres && c.employesDisponibles?.length)
    if (!libre) continue
    return appel('/api/reservations', {
      jeton: t, methode: 'POST',
      corps: {
        salonId, prestationId,
        employeId: libre.employesDisponibles[0],
        debut: libre.debut,
        noteClient: null,
      },
    })
  }
  return null
}

/**
 * Les salons en ligne, avec une prestation chacun.
 *
 * Découverts plutôt que codés en dur. Les identifiants ne sont pas les mêmes
 * d'une base à l'autre : le script écrit pour le développement refusait tout
 * sur la pile de partage — « cette prestation n'appartient pas à ce salon »,
 * quatorze fois de suite — parce qu'il y demandait le salon 1 et la
 * prestation 7, qui existent des deux côtés sans rien avoir en commun.
 */
async function salonsAvecPrestations(combien) {
  const page = await appel('/api/public/salons?size=40')
  const salons = (page.content ?? []).filter((s) => s.statut !== 'EN_ATTENTE')
  const retenus = []
  for (const salon of salons) {
    if (retenus.length >= combien) break
    /* Par la fiche publique, et non par `/api/prestations/salon/…` : ce
       dernier est un point d'entrée professionnel, qui répond 401 à qui n'a
       pas de jeton — et la cliente n'en a pas pour ce salon. */
    const fiche = await appel(`/api/public/salons/${salon.id}`).catch(() => null)
    const prestations = fiche?.prestations ?? []
    if (prestations.length === 0) continue
    retenus.push({ id: salon.id, nom: salon.nom, prestations: prestations.map((p) => p.id) })
  }
  return retenus
}

async function semerCliente(tClient, tAdmin) {
  console.log('\n─── La cliente ─────────────────────────────────────')

  const salons = await salonsAvecPrestations(3)
  if (salons.length === 0) { dit(false, 'aucun salon en ligne avec un catalogue'); return }

  /* Plusieurs salons, étalés sur dix jours : le tableau de bord montre le
     prochain rendez-vous en grand et les suivants en dessous, il faut donc
     plus d'un. */
  const QUAND = [[1, '09:00'], [2, '14:00'], [4, '11:00'], [9, '16:00']]
  const voulus = QUAND.map(([jours, apres], i) => {
    const salon = salons[i % salons.length]
    return {
      salonId: salon.id,
      prestationId: salon.prestations[i % salon.prestations.length],
      jours, apres, ou: salon.nom,
    }
  })

  for (const v of voulus) {
    try {
      const r = await reserverPourLaCliente(tClient, v)
      if (!r) { dit(false, `aucun créneau libre chez ${v.ou} dans les jours qui suivent le ${dateLocale(v.jours)}`); continue }
      dit(true, `${r.prestation} chez ${r.salonNom}, ${r.debut.slice(0, 16).replace('T', ' à ')} UTC`)
    } catch (e) {
      dit(false, `${v.ou} : ${e.message}`)
    }
  }

  /*
   * Deux visites honorées qui attendent leur avis.
   *
   * On réserve normalement, on recule les dates, puis on marque la visite
   * honorée par l'API — laquelle est alors dans son droit, puisque le
   * rendez-vous est passé. Seul le recul des dates échappe à l'API.
   */
  const aReculer = []
  const passees = [[3, '09:00'], [8, '15:00']].map(([recul, apres], i) => {
    const salon = salons[(i + 1) % salons.length]
    return {
      salonId: salon.id,
      prestationId: salon.prestations[(i + 1) % salon.prestations.length],
      jours: 1, apres, recul, ou: salon.nom,
    }
  })
  for (const v of passees) {
    try {
      const r = await reserverPourLaCliente(tClient, v)
      if (!r) { dit(false, `aucun créneau à reculer chez ${v.ou}`); continue }
      aReculer.push({ id: r.id, recul: v.recul, ou: v.ou, quoi: r.prestation })
    } catch (e) {
      dit(false, `${v.ou} : ${e.message}`)
    }
  }

  for (const r of aReculer) {
    try {
      await sql(`UPDATE reservation
                 SET debut = debut - INTERVAL '${r.recul} days',
                     fin   = fin   - INTERVAL '${r.recul} days'
                 WHERE id = ${r.id}`)
      await appel(`/api/pro/reservations/${r.id}/statut?statut=HONOREE`,
        { jeton: tAdmin, methode: 'PATCH' })
      dit(true, `${r.quoi} chez ${r.ou}, il y a ${r.recul} jours — avis encore à donner`)
    } catch (e) {
      dit(false, `visite passée chez ${r.ou} : ${e.message}`)
    }
  }
}

/* ---------------------------------------------------------------- */
/* Le gérant                                                        */
/* ---------------------------------------------------------------- */

/*
 * Des clients qui n'ont pas de compte : c'est le cas courant au comptoir, et
 * c'est précisément ce que la saisie hors ligne existe pour couvrir.
 */
const CLIENTELE = [
  ['Mme Bennani', '0661112233'], ['M. Tazi', '0662223344'],
  ['Mme Alaoui', '0663334455'], ['M. Berrada', '0664445566'],
  ['Mme Sekkat', '0665556677'], ['M. Lahlou', '0666667788'],
  ['Mme Kettani', '0667778899'], ['M. Fassi', '0668889900'],
  ['Mme Chaoui', '0669990011'], ['M. Amrani', '0661230011'],
]

async function semerGerant(t) {
  console.log('\n─── Le gérant ──────────────────────────────────────')

  /*
   * Le premier salon en ligne du gérant, avec son catalogue et son équipe.
   *
   * Découverts, comme du côté cliente : un numéro de salon écrit en dur ne
   * désigne pas le même établissement d'une base à l'autre, et la saisie
   * échoue alors dix fois de suite sur « cette prestation n'appartient pas à
   * ce salon ».
   */
  const miens = await appel('/api/salons/me', { jeton: t })
  const enLigne = miens.filter((x) => x.statut === 'ACTIF')
  if (enLigne.length === 0) { dit(false, 'aucun salon en ligne sur ce compte'); return }

  let SALON = null
  let PRESTATIONS = []
  let employes = []
  for (const candidat of enLigne) {
    const p = await appel(`/api/prestations/salon/${candidat.id}`, { jeton: t }).catch(() => [])
    const e = await appel(`/api/pro/salons/${candidat.id}/employes`, { jeton: t }).catch(() => [])
    if (p.length === 0 || e.length === 0) continue
    SALON = candidat.id
    PRESTATIONS = p.map((x) => [x.id, x.dureeMinutes])
    employes = e.map((x) => x.id)
    dit(true, `chez ${candidat.nom} — ${p.length} prestations, ${e.length} praticien${e.length > 1 ? 's' : ''}`)
    break
  }
  if (!SALON) { dit(false, 'aucun salon en ligne avec un catalogue et une équipe'); return }

  /*
   * Ce soir d'abord.
   *
   * La journée du gérant ne retient que ce qui n'est pas encore terminé :
   * peuplée aux heures d'ouverture, elle est déjà vide dès 19 h, et l'écran
   * qu'on veut essayer affiche « plus rien au programme » toute la soirée.
   * Un barbier qui reçoit tard n'a rien d'invraisemblable au Maroc.
   */
  const maintenant = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', hour12: false })
      .format(new Date()))
  const ceSoir = []
  for (let h = maintenant + 1; h <= 23 && ceSoir.length < 4; h++) ceSoir.push([0, h, 0])

  /* Puis demain, une vraie journée pleine. */
  const demain = [[1, 9, 0], [1, 9, 45], [1, 10, 30], [1, 11, 15],
                  [1, 14, 0], [1, 15, 0], [1, 16, 0], [1, 17, 30]]

  const creneaux = [...ceSoir, ...demain]
  let i = 0
  for (const [jours, h, m] of creneaux) {
    const [nom, tel] = CLIENTELE[i % CLIENTELE.length]
    const [prestationId] = PRESTATIONS[i % PRESTATIONS.length]
    const employeId = employes[i % employes.length]
    i += 1
    try {
      const r = await appel(`/api/pro/salons/${SALON}/reservations`, {
        jeton: t, methode: 'POST',
        corps: {
          prestationId, employeId,
          debut: instant(jours, h, m),
          clientNom: nom, clientTelephone: tel,
          note: null, origine: 'TELEPHONE',
        },
      })
      dit(true, `${jours === 0 ? 'ce soir' : 'demain'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} — ${r.prestation} pour ${nom}`)
    } catch (e) {
      /* Un créneau déjà pris n'est pas une panne : on le dit et on continue. */
      dit(false, `${jours === 0 ? 'ce soir' : 'demain'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} — ${e.message}`)
    }
  }
}

/* ---------------------------------------------------------------- */
/* L'équipe                                                         */
/* ---------------------------------------------------------------- */

const PROSPECTS = [
  {
    nomEtablissement: 'Salon Lalla Yasmine', metiers: ['COIFFURE', 'ESTHETIQUE'],
    ville: 'Marrakech', quartier: 'Guéliz', anciennete: 'PLUS_3_ANS',
    nombreCollaborateurs: 5, outilActuel: 'Cahier papier',
    prenom: 'Yasmine', nom: 'Squalli', telephone: '0661020304',
    email: 'yasmine.squalli@example.ma',
    message: "On refuse du monde le samedi faute de savoir qui a réservé.",
  },
  {
    nomEtablissement: 'Barbier du Port', metiers: ['BARBIER'],
    ville: 'Tanger', quartier: 'Marshan', anciennete: 'DE_1_A_3_ANS',
    nombreCollaborateurs: 2, outilActuel: 'WhatsApp',
    prenom: 'Mehdi', nom: 'Ouazzani', telephone: '0662030405',
    email: 'mehdi.ouazzani@example.ma',
    message: 'Je passe mes soirées à répondre aux messages.',
  },
  {
    nomEtablissement: 'Hammam Zahra', metiers: ['SPA_HAMMAM'],
    ville: 'Fès', quartier: 'Agdal', anciennete: 'MOINS_1_AN',
    nombreCollaborateurs: 3, outilActuel: null,
    prenom: 'Zahra', nom: 'Idrissi', telephone: '0663040506',
    email: 'zahra.idrissi@example.ma',
    message: "Ouvert depuis février, on cherche à se faire connaître.",
  },
  {
    nomEtablissement: "L'Atelier des Ongles", metiers: ['ONGLERIE'],
    ville: 'Rabat', quartier: 'Hassan', anciennete: 'EN_PROJET',
    nombreCollaborateurs: 1, outilActuel: null,
    prenom: 'Salma', nom: 'Benkirane', telephone: '0664050607',
    email: 'salma.benkirane@example.ma',
    message: "Ouverture prévue en janvier, je veux partir sur de bonnes bases.",
  },
]

async function semerEquipe() {
  console.log("\n─── L'équipe ───────────────────────────────────────")
  for (const p of PROSPECTS) {
    try {
      await appel('/api/public/demandes-demo', { methode: 'POST', corps: p })
      dit(true, `${p.nomEtablissement} — ${p.ville}`)
    } catch (e) {
      dit(false, `${p.nomEtablissement} : ${e.message}`)
    }
  }
}

/* ---------------------------------------------------------------- */

/*
 * Les parties demandées, ou toutes.
 *
 * Rejouer une seule partie sert quand une journée s'est vidée d'un côté
 * seulement — la soirée du gérant est passée, mais la file de l'équipe est
 * toujours pleine, et la regarnir ne ferait qu'ajouter du bruit.
 */
const PARTIES = ['cliente', 'gerant', 'equipe']
const demandees = process.argv.slice(2).map((a) => a.toLowerCase())
const inconnues = demandees.filter((d) => !PARTIES.includes(d))
if (inconnues.length > 0) {
  console.error(`Partie inconnue : ${inconnues.join(', ')}. Attendu : ${PARTIES.join(', ')}.`)
  process.exit(2)
}
const aFaire = demandees.length > 0 ? demandees : PARTIES

const [tAdmin, tPro, tClient] = await Promise.all(
  [COMPTES.admin, COMPTES.pro, COMPTES.client].map(jeton))

if (aFaire.includes('cliente')) await semerCliente(tClient, tAdmin)
if (aFaire.includes('gerant')) await semerGerant(tPro)
if (aFaire.includes('equipe')) await semerEquipe()

console.log(`\n${poses} entrée${poses > 1 ? 's' : ''} posée${poses > 1 ? 's' : ''}`
  + (refuses ? `, ${refuses} refusée${refuses > 1 ? 's' : ''} (voir ci-dessus)` : ''))
console.log('\nÀ essayer :')
console.log('  client1@darzin.ma / client1  — le prochain rendez-vous, et deux avis à donner')
console.log('  pro1@darzin.ma    / pro1     — la journée chez Atlas Barber')
console.log('  admin@darzin.ma   / admin    — la file des demandes')
