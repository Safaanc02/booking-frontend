/**
 * Parcours automatisé du tunnel de réservation, de bout en bout.
 *
 * Suppose la stack démarrée : docker compose, l'API sur 8080, Vite sur 5173,
 * et au moins un salon ACTIF avec des prestations, des praticiens et des horaires.
 *
 *   npm run verifier:tunnel
 *
 * Ne remplace pas des tests unitaires : c'est un filet de sécurité sur le
 * parcours critique, celui dont dépend tout le chiffre d'affaires.
 */
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/*
 * Adresses pilotables par l'environnement.
 *
 * En développement, chaque service a son port. Dans la pile partagée, tout
 * tient derrière une seule adresse — le site à la racine, l'API sous /api,
 * Keycloak sous /auth, la boîte de test sous /courrier. Les mêmes suites
 * doivent pouvoir vérifier les deux, sans quoi la configuration qu'on livre
 * n'est jamais celle qu'on a testée.
 *
 *   BASE_URL=https://essai.exemple.ma API_URL=https://essai.exemple.ma/api \
 *   KC_URL=https://essai.exemple.ma/auth MAILPIT_URL=https://essai.exemple.ma/courrier \
 *     npm run verifier:accueil
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
/**
 * Arguments supplémentaires pour le navigateur.
 *
 * Sert notamment à vérifier une pile joignable par une adresse que le
 * résolveur local ignore — certaines box ne répondent pas sur les
 * sous-domaines de tunnel :
 *
 *   CHROME_ARGS='--host-resolver-rules="MAP essai.exemple.com 1.2.3.4"'
 *
 * Le découpage respecte les guillemets. Un simple split sur l'espace coupait
 * la règle ci-dessus en trois arguments, dont Chrome prenait les deux
 * derniers pour des adresses à ouvrir — il refusait alors de démarrer.
 */
const ARGS_SUP = (process.env.CHROME_ARGS ?? '')
  .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((a) => a.replace(/["']/g, '')) ?? []
const ok = (c) => (c ? '✅' : '❌')

// Compte de démonstration du realm Keycloak importé par docker compose.
const IDENTIFIANT = process.env.TEST_USER ?? 'client1'
const MOT_DE_PASSE = process.env.TEST_PASSWORD ?? 'client1'

/* ---- Utilitaires d'API, pour préparer et vérifier hors interface ---- */
const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'
const SALON = Number(process.env.SALON_ID ?? 1)

const jeton = async (identifiant) => {
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', username: identifiant, password: identifiant, grant_type: 'password',
    }),
  })
  if (!r.ok) throw new Error(`authentification ${identifiant} impossible (${r.status})`)
  return (await r.json()).access_token
}

const appel = async (chemin, options = {}, token) => {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const corps = r.status === 204 ? null : await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${options.method ?? 'GET'} ${chemin} → ${r.status} ${JSON.stringify(corps)}`)
  return corps
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })

/**
 * Deux catégories distinctes, et une seule fait échouer le test.
 *
 * `pageerror` signale une exception JavaScript : c'est un défaut. Les messages
 * console de type error incluent aussi les réponses HTTP 4xx/5xx journalisées
 * par le navigateur — or un 409 « créneau déjà réservé » est une réponse
 * applicative correcte, que l'interface est faite pour gérer. Les confondre
 * rendait le test rouge alors que tout fonctionnait.
 */
const erreurs = []
const reseau = []
const brancher = (p) => {
  p.on('pageerror', (e) => erreurs.push(String(e)))
  p.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/Failed to load resource|net::ERR_/.test(t)) {
      const url = m.location()?.url ?? ''
      reseau.push(`${t} — ${url.replace('http://localhost:8080', '')}`)
    }
    else erreurs.push(t)
  })
}
brancher(page)

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const txtDe = (p) => p.evaluate(() => document.body.innerText)
/*
 * Délai d'attente par défaut des aides ci-dessous.
 *
 * Relevé de 15 à 25 secondes : à travers un tunnel, chaque requête coûte un
 * aller-retour hors du réseau local, et la vérification de session initiale
 * dépassait la fenêtre. Un test qui patiente ne coûte du temps que lorsque
 * quelque chose est réellement cassé.
 */
const ATTENTE = 25000

const txt = () => txtDe(page)
/**
 * Comparaison insensible à la casse et aux accents.
 * innerText renvoie le texte tel qu'il est PEINT : un titre en
 * text-transform:uppercase ressort en majuscules, pas tel qu'écrit en JSX.
 */
const contient = (source, attendu) =>
  source.toLocaleLowerCase('fr').includes(attendu.toLocaleLowerCase('fr'))

/**
 * Attend qu'un texte apparaisse, plutôt que de dormir un délai arbitraire.
 *
 * Les pauses fixes rendaient ce script instable : une première navigation un
 * peu lente (Vite qui retransforme après une modification) suffisait à faire
 * échouer l'étape 1 alors que l'application était correcte.
 */
const attendreSur = async (p, attendu, timeout = ATTENTE) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txtDe(p), attendu)) return true
    await pause(150)
  }
  return false
}
const attendre = (attendu, timeout) => attendreSur(page, attendu, timeout)

/** Attend que des créneaux horaires soient rendus, et les renvoie. */
const attendreCreneaux = async (timeout = ATTENTE) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    const c = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map((b) => b.innerText).filter((s) => /^\d{2}:\d{2}$/.test(s)))
    if (c.length > 0) return c
    await new Promise((r) => setTimeout(r, 150))
  }
  return []
}
/**
 * Déclenche le clic depuis le DOM plutôt qu'avec la souris.
 *
 * ElementHandle.click() vise le centre géométrique et rate la cible quand la
 * page se recale entre le scroll et le clic — ce qui donne un faux négatif
 * silencieux : aucune erreur, aucune requête.
 */
const clicSur = async (p, filtre, timeout = ATTENTE) => {
  const limite = Date.now() + timeout
  let fait = false
  while (Date.now() < limite && !fait) {
    fait = await p.evaluate((f) => {
      const els = [...document.querySelectorAll('button, a')]
      const el = els.find((e) => e.innerText.trim() === f) ?? els.find((e) => e.innerText.includes(f))
      if (!el || el.disabled) return false
      el.click()
      return true
    }, filtre)
    if (!fait) await pause(150)
  }
  if (!fait) throw new Error(`introuvable ou désactivé après ${timeout} ms : ${filtre}`)
  await pause(400)
}
const clic = (filtre, timeout) => clicSur(page, filtre, timeout)

console.log('─── Étape 1 : choix de la prestation ───────────────')
await page.goto(`${BASE}/salon/1/reserver`, { waitUntil: 'networkidle0' })
console.log(' ', ok(await attendre('Quelle prestation')), 'titre affiché')
let t = await txt()
console.log(' ', ok(t.includes('Coupe femme') && t.includes('Balayage')), 'les 2 prestations listées')
console.log(' ', ok(t.includes('200,00') && t.includes('650,00')), 'prix en MAD')

console.log('\n─── Étape 2 : choix du praticien ───────────────────')
await clic('Coupe femme')
console.log(' ', ok(await attendre('Avec qui')), 'titre affiché')
// La liste des praticiens est demandée à l'API : elle arrive après le titre.
// Lue au vol, elle manquait dès que la latence dépassait quelques
// millisecondes — c'est-à-dire dès qu'on sortait de la machine.
const praticiens = (await attendre('Sofia')) && (await attendre('Youssef'))
t = await txt()
console.log(' ', ok(t.includes('Sans préférence')), '« sans préférence » proposé par défaut')
console.log(' ', ok(praticiens), 'les 2 praticiens de la coupe')

console.log('\n─── Étape 3 : choix du créneau ─────────────────────')
await clic('Sans préférence')
console.log(' ', ok(await attendre('Quand ?')), 'titre affiché')
const creneaux = await attendreCreneaux()
console.log(' ', ok(creneaux.length > 0), `${creneaux.length} créneaux — ${creneaux.slice(0, 6).join(' ')}…`)
const joursBarres = await page.evaluate(() =>
  [...document.querySelectorAll('button[disabled]')].filter((b) => b.className.includes('line-through')).length)
console.log(' ', ok(joursBarres > 0), `${joursBarres} jour(s) barré(s) — les dimanches et jours pleins`)

console.log('\n─── Étape 4 : récapitulatif ────────────────────────')
await clic(creneaux[0])
console.log(' ', ok(await attendre('Récapitulatif')), 'titre affiché')
t = await txt()
console.log(' ', ok(t.includes('Coupe femme')), 'prestation reprise')
console.log(' ', ok(t.includes('À régler sur place')), 'montant à régler sur place')
console.log(' ', ok(/Annulation gratuite jusqu'à \d+ h/.test(t)), 'politique d\'annulation affichée')
console.log(' ', ok(t.includes('Se connecter et confirmer')),
  'le compte n\'est demandé qu\'à la dernière étape')

console.log('\n─── Retour arrière via le fil d\'Ariane ─────────────')
await clic('Praticien')
console.log(' ', ok(await attendre('Avec qui')), 'retour à l\'étape 2 sans tout perdre')

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/tunnel.png' })
await page.goto(`${BASE}/salon/1/reserver?prestationId=1`, { waitUntil: 'networkidle0' })
await clic('Sans préférence')
await new Promise((r) => setTimeout(r, 1600))
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/creneaux.png' })

console.log('\n─── Connexion au dernier moment ────────────────────')
// On repart d'un tunnel neuf, prestation pré-sélectionnée depuis la fiche salon.
await page.goto(`${BASE}/salon/1/reserver?prestationId=1`, { waitUntil: 'networkidle0' })
await clic('Sans préférence')
await attendreCreneaux()
/**
 * On choisit un jour éloigné, pas le premier disponible.
 *
 * Les salons exigent un préavis d'annulation (12 h chez Dar Zine). Réserver
 * le premier créneau libre — souvent quelques heures plus tard — rendait la
 * réservation non annulable, et le serveur répondait 409 à juste titre. Le
 * test doit se placer dans le cas qu'il prétend vérifier.
 */
const joursOuverts = await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .filter((b) => !b.disabled && /^\w+\.? \d+ \w+\.?$/.test(b.innerText.trim()))
    .map((b) => b.innerText.trim()))
const jourLointain = joursOuverts[Math.min(2, joursOuverts.length - 1)]
await clic(jourLointain)
const dispos = await attendreCreneaux()
console.log(' ', ok(dispos.length > 0), `jour retenu : ${jourLointain} (${dispos.length} créneaux)`)
const retenu = dispos[dispos.length - 1]
await clic(retenu)

await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  clic('Se connecter et confirmer'),
])
await new Promise((r) => setTimeout(r, 1000))
// Reconnu à son chemin et non à son port : derrière un proxy unique,
// Keycloak partage l'origine du site et vit sous /auth. Le test ne doit pas
// dépendre de la topologie choisie pour l'hébergement.
console.log(' ', ok(/\/realms\/[^/]+\/protocol\/openid-connect|\/login-actions\//.test(page.url())),
  `redirigé vers Keycloak (${new URL(page.url()).pathname.slice(0, 48)}…)`)

await page.type('#username', IDENTIFIANT)
await page.type('#password', MOT_DE_PASSE)
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  page.click('#kc-login'),
])
console.log(' ', ok(await attendre('Récapitulatif')), 'retour sur l\'application')
t = await txt()
console.log(' ', ok(t.includes('Récapitulatif')),
  'le choix survit à la redirection — sinon tout serait à refaire')
console.log(' ', ok(page.url().startsWith(BASE)), 'de retour sur l\'application')
console.log(' ', ok(t.includes(retenu)), `créneau ${retenu} conservé`)

console.log('\n─── Confirmation ───────────────────────────────────')
await clic('Confirmer la réservation')
await attendre('réservation est confirmée')
t = await txt()
console.log(' ', ok(page.url().includes('/compte')), 'redirigé vers le compte')
console.log(' ', ok(t.includes('réservation est confirmée')), 'message de confirmation')

/*
 * La liste est attendue, non lue au vol.
 *
 * La bannière de confirmation s'affiche dès l'arrivée sur /compte ; les
 * réservations, elles, sont chargées ensuite. En local l'écart est
 * imperceptible et un instantané pris juste après suffisait. À travers un
 * tunnel, chaque requête coûte un demi-tour du monde : le même instantané
 * arrivait avant la liste, et quatre assertions tombaient sur un produit
 * parfaitement fonctionnel.
 */
console.log(' ', ok(await attendre('À venir')), 'classée dans « à venir »')
console.log(' ', ok(await attendre('Confirmée')), 'statut CONFIRMEE')
// La ligne annulable doit être là avant qu'on la cherche.
await page.waitForSelector('li[data-reservation-id]', { timeout: 15000 }).catch(() => {})
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/compte.png' })

console.log('\n─── Annulation ─────────────────────────────────────')
/**
 * On annule la réservation que ce test vient de créer, repérée par son heure.
 *
 * Une version précédente cliquait le premier bouton « Annuler » de la liste.
 * Sur un jeu de données accumulé, c'était parfois un rendez-vous hors délai :
 * le serveur répondait 409 à juste titre, et les assertions suivantes
 * trouvaient quand même « Annulée » sur une ligne plus ancienne. Le test
 * passait sans rien avoir annulé.
 */
/**
 * On repère la ligne par jour ET heure, puis on retient son identifiant.
 *
 * Un repérage par la seule heure était ambigu : les exécutions précédentes
 * laissent d'autres réservations au même horaire, et le script annulait
 * parfois une ligne plus ancienne tout en concluant au succès.
 */
const jourNumero = (jourLointain.match(/\d+/) ?? [''])[0]
const cible = await page.evaluate((heure, jour) => {
  const ligne = [...document.querySelectorAll('li[data-reservation-id]')].find(
    (li) => li.innerText.includes(`à ${heure}`)
            && new RegExp(`\\b${jour}\\b`).test(li.innerText)
            && li.innerText.includes('Annuler'))
  if (!ligne) return null
  const bouton = [...ligne.querySelectorAll('button')].find((b) => b.innerText.includes('Annuler'))
  if (!bouton) return null
  bouton.click()
  return ligne.dataset.reservationId
}, retenu, jourNumero)
console.log(' ', ok(cible !== null),
  cible ? `réservation #${cible} (${jourLointain} à ${retenu}) — annulation demandée`
        : 'ligne annulable introuvable ❌')

/** On attend que CETTE ligne ait rejoint l'historique, pas qu'un mot apparaisse. */
const sectionDe = (id) => page.evaluate((id) => {
  for (const s of document.querySelectorAll('section')) {
    const ligne = s.querySelector(`li[data-reservation-id="${id}"]`)
    if (ligne) return { section: s.querySelector('h2')?.innerText ?? '', texte: ligne.innerText }
  }
  return null
}, id)

let etatLigne = null
const limiteAnnulation = Date.now() + 15000
while (cible && Date.now() < limiteAnnulation) {
  etatLigne = await sectionDe(cible)
  if (etatLigne && /historique/i.test(etatLigne.section)) break
  await new Promise((r) => setTimeout(r, 200))
}
console.log(' ', ok(etatLigne !== null && /historique/i.test(etatLigne.section)),
  etatLigne ? `la réservation #${cible} est passée dans « ${etatLigne.section} »` : 'ligne introuvable ❌')
console.log(' ', ok(etatLigne !== null && etatLigne.texte.includes('Annulée')),
  'son statut affiché est « Annulée »')

console.log('\n─── Annulation depuis l\'email ──────────────────────')
/**
 * Le lien signé reçu par email permet d'annuler sans se connecter.
 *
 * Le jeton est récupéré dans Mailpit, le serveur SMTP de développement. Si
 * Mailpit n'est pas joignable, cette section est annoncée comme non exécutée
 * plutôt que silencieusement sautée : un test qui se taît fait croire à une
 * couverture qu'il n'a pas.
 */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'
let mailpitJoignable = false
try {
  mailpitJoignable = (await fetch(`${MAILPIT}/api/v1/messages`, { signal: AbortSignal.timeout(3000) })).ok
} catch {
  mailpitJoignable = false
}

if (!mailpitJoignable) {
  console.log('   ⚠️  Mailpit injoignable — section NON exécutée (docker compose up mailpit)')
} else {
  // Nouvelle réservation dédiée : celle du tunnel vient d'être annulée.
  const client = await jeton('client1')
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })

  const fiche = await (await fetch(`${API}/api/public/salons/${SALON}`)).json()
  const prestation = fiche.prestations[0]
  const jours = await (await fetch(
    `${API}/api/public/salons/${SALON}/prochaines-dispos?prestationId=${prestation.id}&jours=14`)).json()
  // Un jour éloigné, pour rester dans le préavis d'annulation du salon.
  const jourCible = jours[Math.min(2, jours.length - 1)]
  const dispos = await (await fetch(
    `${API}/api/public/salons/${SALON}/disponibilites?prestationId=${prestation.id}&date=${jourCible}`)).json()
  const creneau = dispos.creneaux[dispos.creneaux.length - 1]

  const creee = await appel('/api/reservations', {
    method: 'POST',
    body: JSON.stringify({ salonId: SALON, prestationId: prestation.id, debut: creneau.debut }),
  }, client)
  console.log(' ', ok(!!creee.id), `réservation #${creee.id} créée pour le test du lien`)

  // L'email part de façon asynchrone, après le commit de la transaction.
  let lien = null
  const limiteMail = Date.now() + 20000
  while (Date.now() < limiteMail && !lien) {
    const boite = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
    const confirmation = boite.messages?.find((m) => m.Subject.includes('confirmé'))
    if (confirmation) {
      const detail = await (await fetch(`${MAILPIT}/api/v1/message/${confirmation.ID}`)).json()
      const trouve = /\/annuler\?token=([\w.\-]+)/.exec(detail.HTML ?? '')
      if (trouve) lien = trouve[1]
    }
    if (!lien) await pause(400)
  }
  console.log(' ', ok(lien !== null), lien ? 'lien d\'annulation présent dans l\'email' : 'lien absent ❌')

  if (lien) {
    // Contexte neuf, sans session : c'est tout l'intérêt du lien signé.
    const contexteAnonyme = await browser.createBrowserContext()
    const pageAnonyme = await contexteAnonyme.newPage()
    await pageAnonyme.setViewport({ width: 1280, height: 900 })
    await pageAnonyme.setCacheEnabled(false)
    brancher(pageAnonyme)

    await pageAnonyme.goto(`${BASE}/annuler?token=${lien}`, { waitUntil: 'networkidle0' })
    console.log(' ', ok(await attendreSur(pageAnonyme, 'Annuler ce rendez-vous')),
      'page accessible sans être connecté')
    console.log(' ', ok(await attendreSur(pageAnonyme, prestation.nom)),
      'le rendez-vous visé est bien décrit')

    await clicSur(pageAnonyme, "Confirmer l'annulation")
    console.log(' ', ok(await attendreSur(pageAnonyme, 'Rendez-vous annulé')), 'annulation confirmée')

    // Le serveur est seul juge : on vérifie l'état réel, pas l'écran.
    const apres = await appel('/api/reservations/me', {}, client)
    const ligne = apres.find((r) => r.id === creee.id)
    console.log(' ', ok(ligne?.statut === 'ANNULEE_CLIENT'),
      `statut en base : ${ligne?.statut}`)

    if (process.env.SHOT) await pageAnonyme.screenshot({ path: process.env.SHOT + '/annulation-lien.png' })
    await contexteAnonyme.close()
  }
}

console.log('\n─── Bilan ──────────────────────────────────────────')
console.log(' ', ok(erreurs.length === 0),
  erreurs.length === 0 ? 'aucune erreur JavaScript' : `erreurs JS : ${erreurs.slice(0, 3).join(' | ')}`)
if (reseau.length > 0) {
  console.log(`   ${reseau.length} réponse(s) HTTP en erreur, gérées par l'interface :`)
  for (const r of [...new Set(reseau)].slice(0, 3)) console.log(`     ${r}`)
}

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
