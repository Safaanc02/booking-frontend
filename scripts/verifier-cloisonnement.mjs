/**
 * Les trois règles qui ne doivent jamais céder.
 *
 * Les neuf autres suites passent par l'écran : elles vérifient qu'on peut
 * faire ce qu'on doit pouvoir faire. Celle-ci fait l'inverse, et sans
 * navigateur — elle appelle l'API directement, avec des jetons valides, comme
 * le ferait quelqu'un qui a lu la documentation et veut voir ce qu'elle laisse
 * passer. Une interface qui masque un bouton ne protège rien.
 *
 * Les trois règles :
 *
 *   1. Un gérant ne lit pas le salon d'un autre. C'est la promesse minimale
 *      d'une plateforme partagée : voir l'agenda du concurrent d'en face, ce
 *      serait connaître son chiffre, ses horaires creux et ses clientes.
 *
 *   2. Une note de suivi ne franchit pas les murs du salon qui l'a écrite.
 *      Ce qu'un coiffeur note sur une cliente peut toucher à son apparence ou
 *      à sa santé. C'est la clause que nos conditions promettent noir sur
 *      blanc, et la première qu'on nous demandera de prouver.
 *
 *   3. Deux clientes ne prennent pas le même créneau. Garanti par une
 *      contrainte d'exclusion en base, et non par du code applicatif — mais
 *      une contrainte se supprime par mégarde dans une migration, et rien ne
 *      le signalerait avant que deux femmes ne se présentent à la même heure.
 *
 * S'y ajoute un quatrième bloc : le déplacement d'un rendez-vous doit obéir
 * aux mêmes règles que l'annulation. Sans quoi le préavis ne vaut rien — il
 * suffit de déplacer au mois suivant ce qu'on n'a plus le droit d'annuler.
 *
 *   npm run verifier:cloisonnement
 */
const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'

const COMPTES = {
  admin:  [process.env.ADMIN_USER ?? 'admin', process.env.ADMIN_PASS ?? 'admin'],
  proA:   [process.env.PRO_A_USER ?? 'pro.riadnour', process.env.PRO_A_PASS ?? 'pro.riadnour'],
  proB:   [process.env.PRO_B_USER ?? 'pro.nails', process.env.PRO_B_PASS ?? 'pro.nails'],
  client: [process.env.CLIENT_USER ?? 'client1', process.env.CLIENT_PASS ?? 'client1'],
}

const ok = (c) => (c ? '✅' : '❌')
let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}

async function jeton(identifiant, motDePasse) {
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', grant_type: 'password',
      username: identifiant, password: motDePasse,
    }),
  })
  if (!r.ok) return null
  return (await r.json()).access_token
}

/**
 * Appel brut : on veut le code, pas une exception.
 *
 * `texte` sert les routes qui prennent un corps brut plutôt que du JSON — la
 * note de suivi en est une. L'envoyer en JSON valait un 400 que la suite
 * comptait comme un échec de cloisonnement, alors que le cloisonnement n'avait
 * jamais été éprouvé : la note n'avait tout simplement pas été écrite.
 */
async function appel(chemin, { jeton: j, methode = 'GET', corps = null, texte = null } = {}) {
  const r = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: {
      ...(j ? { Authorization: `Bearer ${j}` } : {}),
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
      ...(texte !== null ? { 'Content-Type': 'text/plain' } : {}),
    },
    body: corps ? JSON.stringify(corps) : (texte !== null ? texte : undefined),
  })
  let donnees = null
  try { donnees = await r.json() } catch { /* 204, ou corps vide */ }
  return { statut: r.status, donnees }
}

/* ------------------------------------------------------------------ */

console.log('\n─── jetons ' + '─'.repeat(38))
const jetons = {}
for (const [role, [u, p]] of Object.entries(COMPTES)) {
  jetons[role] = await jeton(u, p)
  if (!dire(Boolean(jetons[role]), `${role} (${u}) obtient un jeton`)) {
    console.log('\n❌ impossible de continuer sans ce compte')
    process.exit(1)
  }
}

/* Quel salon appartient à qui ? L'administration le sait ; c'est le seul
   endroit où l'on peut légitimement voir les deux côtés à la fois. */
const { donnees: mesA } = await appel('/api/salons/me', { jeton: jetons.proA })
const { donnees: mesB } = await appel('/api/salons/me', { jeton: jetons.proB })
const salonA = mesA?.[0]
const salonB = mesB?.[0]

if (!dire(Boolean(salonA && salonB), 'les deux gérants ont chacun un salon')) {
  console.log('\n❌ jeu de démonstration incomplet : lancer npm run semer:demo')
  process.exit(1)
}
if (!dire(salonA.id !== salonB.id, 'et ce ne sont pas les mêmes')) {
  process.exit(1)
}
console.log(`    A = « ${salonA.nom} » (${salonA.id}) · B = « ${salonB.nom} » (${salonB.id})`)

/* ---------- 1. Un gérant ne lit pas le salon d'un autre ---------- */

console.log('\n─── 1. cloisonnement entre salons ' + '─'.repeat(16))

const INTERDITS = [
  ['agenda',      `/api/pro/salons/${salonB.id}/agenda?date=2026-09-23&jours=1`],
  ['équipe',      `/api/pro/salons/${salonB.id}/employes`],
  ['horaires',    `/api/pro/salons/${salonB.id}/horaires`],
  ['clients',     `/api/pro/salons/${salonB.id}/clients`],
  ['absences',    `/api/pro/salons/${salonB.id}/absences`],
  ['chiffres',    `/api/pro/salons/${salonB.id}/statistiques`],
]

for (const [quoi, chemin] of INTERDITS) {
  const { statut } = await appel(chemin, { jeton: jetons.proA })
  dire(statut === 403 || statut === 401,
    `A se voit refuser ${quoi} de B (HTTP ${statut})`)
}

/* Et il accède bien au sien : une règle qui refuse tout n'est pas une règle. */
const { statut: sien } = await appel(`/api/pro/salons/${salonA.id}/employes`, { jeton: jetons.proA })
dire(sien === 200, `A accède à sa propre équipe (HTTP ${sien})`)

/* Écriture, pas seulement lecture. */
const { statut: ecriture } = await appel(`/api/pro/salons/${salonB.id}/employes`, {
  jeton: jetons.proA, methode: 'POST',
  corps: { prenom: 'Intrus', nom: 'Test', role: 'PRATICIEN' },
})
dire(ecriture === 403 || ecriture === 401,
  `A ne peut pas ajouter un praticien chez B (HTTP ${ecriture})`)

/* Et une cliente n'entre nulle part dans l'espace professionnel. */
const { statut: cliente } = await appel(`/api/pro/salons/${salonA.id}/clients`, { jeton: jetons.client })
dire(cliente === 403 || cliente === 401,
  `une cliente n'accède pas au fichier clients (HTTP ${cliente})`)

/* ---------- 2. La note de suivi ne sort pas du salon ---------- */

console.log('\n─── 2. les notes de suivi ' + '─'.repeat(24))

const { donnees: clientsA } = await appel(`/api/pro/salons/${salonA.id}/clients`, { jeton: jetons.proA })
const cible = clientsA?.[0]

if (!cible) {
  console.log('  ⚠️  aucun client chez A — bloc ignoré (lancer npm run semer:demo)')
} else {
  const cle = cible.telephone ?? cible.cle ?? cible.email
  const SECRET = `note-cloisonnement-${Date.now()}`

  const { statut: pose } = await appel(
    `/api/pro/salons/${salonA.id}/clients/note?cle=${encodeURIComponent(cle)}`, {
      jeton: jetons.proA, methode: 'PUT', texte: SECRET,
    })
  dire(pose === 200, `A écrit une note sur « ${cible.nom ?? cle} » (HTTP ${pose})`)

  /* B interroge la même personne, par la même clé. */
  const { statut: chezB, donnees: ficheB } = await appel(
    `/api/pro/salons/${salonB.id}/clients/fiche?cle=${encodeURIComponent(cle)}`,
    { jeton: jetons.proB })

  const fuite = JSON.stringify(ficheB ?? {}).includes(SECRET)
  dire(!fuite, `la note de A est invisible depuis B (HTTP ${chezB})`)

  /* Et B ne peut pas simplement demander la fiche via le salon de A. */
  const { statut: detourne } = await appel(
    `/api/pro/salons/${salonA.id}/clients/fiche?cle=${encodeURIComponent(cle)}`,
    { jeton: jetons.proB })
  dire(detourne === 403 || detourne === 401,
    `B ne peut pas lire la fiche par le salon de A (HTTP ${detourne})`)

  /* A la relit bien : le cloisonnement ne doit pas être un effacement. */
  const { donnees: ficheA } = await appel(
    `/api/pro/salons/${salonA.id}/clients/fiche?cle=${encodeURIComponent(cle)}`,
    { jeton: jetons.proA })
  dire(JSON.stringify(ficheA ?? {}).includes(SECRET), 'A relit sa propre note')

  /* Ménage : la note de test ne reste pas sur une vraie fiche. */
  await appel(
    `/api/pro/salons/${salonA.id}/clients/note?cle=${encodeURIComponent(cle)}`, {
      jeton: jetons.proA, methode: 'PUT', texte: cible.note ?? '',
    })
}

/* ---------- 3. Deux clientes ne prennent pas le même créneau ---------- */

console.log('\n─── 3. le double créneau ' + '─'.repeat(25))

const { donnees: ficheSalon } = await appel(`/api/public/salons/${salonA.id}`)
const prestation = ficheSalon?.prestations?.[0]

if (!prestation) {
  console.log('  ⚠️  aucune prestation chez A — bloc ignoré')
} else {
  const demain = new Date()
  demain.setDate(demain.getDate() + 2)
  const jour = demain.toISOString().slice(0, 10)

  const { donnees: dispos } = await appel(
    `/api/public/salons/${salonA.id}/disponibilites?prestationId=${prestation.id}&date=${jour}`)
  const creneau = dispos?.creneaux?.[0]

  if (!creneau) {
    console.log(`  ⚠️  aucun créneau libre le ${jour} — bloc ignoré`)
  } else {
    const corps = {
      salonId: salonA.id, prestationId: prestation.id,
      debut: creneau.debut, employeId: creneau.employesDisponibles?.[0] ?? null,
    }

    /* Les deux partent ensemble : c'est la seule façon d'éprouver la course.
       Lancées l'une après l'autre, la seconde verrait le créneau déjà pris et
       le refus viendrait du calcul de disponibilité, pas de la base. */
    const [un, deux] = await Promise.all([
      appel('/api/reservations', { jeton: jetons.client, methode: 'POST', corps }),
      appel('/api/reservations', { jeton: jetons.admin, methode: 'POST', corps }),
    ])

    const reussites = [un, deux].filter((r) => r.statut === 200 || r.statut === 201)
    dire(reussites.length === 1,
      `une seule des deux réservations simultanées passe (${un.statut} / ${deux.statut})`)

    /* Et on nettoie celle qui est passée. */
    for (const r of reussites) {
      const id = r.donnees?.id
      if (id) await appel(`/api/reservations/${id}`, { jeton: jetons.admin, methode: 'DELETE' })
    }

    /* Une heure que le salon ne propose pas doit être refusée, même si la
       base l'accepterait : trois heures du matin ne chevauche rien. */
    const nuit = `${jour}T02:00:00Z`
    const { statut: nocturne } = await appel('/api/reservations', {
      jeton: jetons.client, methode: 'POST', corps: { ...corps, debut: nuit },
    })
    dire(nocturne >= 400,
      `un rendez-vous à 2 h du matin est refusé (HTTP ${nocturne})`)
  }
}

/* ---------- 4. Déplacer n'est pas contourner ---------- */

console.log('\n─── 4. le déplacement obéit aux mêmes règles ' + '─'.repeat(5))

const { donnees: miennes } = await appel('/api/reservations/me', { jeton: jetons.client })
const active = (miennes ?? []).find((r) => r.statut === 'CONFIRMEE' || r.statut === 'EN_ATTENTE')
const figee = (miennes ?? []).find((r) => r.statut === 'HONOREE' || r.statut?.startsWith('ANNULEE'))

if (figee) {
  const { statut } = await appel(`/api/reservations/${figee.id}`, {
    jeton: jetons.client, methode: 'PUT',
    corps: { debut: new Date(Date.now() + 7 * 86400000).toISOString() },
  })
  dire(statut >= 400, `un rendez-vous ${figee.statut} ne se déplace pas (HTTP ${statut})`)
} else {
  console.log('  ⚠️  aucun rendez-vous figé sous la main — cas ignoré')
}

if (active) {
  const passe = new Date(Date.now() - 86400000).toISOString()
  const { statut } = await appel(`/api/reservations/${active.id}`, {
    jeton: jetons.client, methode: 'PUT', corps: { debut: passe },
  })
  dire(statut >= 400, `on ne déplace pas un rendez-vous dans le passé (HTTP ${statut})`)

  /* Et surtout : pas chez quelqu'un d'autre. */
  const { statut: vol } = await appel(`/api/reservations/${active.id}`, {
    jeton: jetons.proB, methode: 'PUT',
    corps: { debut: new Date(Date.now() + 3 * 86400000).toISOString() },
  })
  dire(vol >= 400, `un tiers ne déplace pas le rendez-vous d'autrui (HTTP ${vol})`)
} else {
  console.log('  ⚠️  aucun rendez-vous actif sous la main — cas ignorés')
}

console.log(`\n${echecs === 0 ? '✅ les trois règles tiennent' : `❌ ${echecs} échec(s)`}`)
process.exit(echecs === 0 ? 0 : 1)
