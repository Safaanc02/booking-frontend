/**
 * Référencement d'un salon par l'équipe, de bout en bout.
 *
 * C'est le parcours d'arrivée d'un professionnel : il ne s'inscrit pas, on
 * l'installe. Un conseiller saisit l'établissement et son gérant, le compte
 * est créé, le gérant reçoit un lien pour choisir son mot de passe, et il
 * arrive dans un espace où son salon est déjà là.
 *
 * Ce script vérifie la chaîne complète — formulaire, e-mail réellement reçu,
 * mot de passe défini, accès au salon, visibilité publique — parce que chaque
 * maillon a déjà cassé au moins une fois en silence.
 *
 * Suppose la stack démarrée (docker compose + API + Vite).
 *
 *   npm run verifier:referencement
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
const API = process.env.API_URL ?? 'http://localhost:8080'
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'
const KC = process.env.KC_URL ?? 'http://localhost:8081'
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

/* Un identifiant par exécution : le script doit pouvoir tourner deux fois. */
const SUFFIXE = Date.now().toString().slice(-6)
const SALON = `Studio Yasmine ${SUFFIXE}`
const GERANT = `yasmine.${SUFFIXE}@example.ma`
const MOT_DE_PASSE = `Gerant!${SUFFIXE}`

let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1100 })
// Les routes publiques renvoient Cache-Control: max-age=60 ; un test qui écrit
// puis relit dans la même minute lirait la version d'avant.
await page.setCacheEnabled(false)

const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  // Un 4xx journalisé par le navigateur n'est pas un défaut : la validation
  // du formulaire en produit à dessein.
  if (!/Failed to load resource|net::ERR_/.test(t)) erreurs.push(t)
})

/*
 * Délai d'attente par défaut des aides ci-dessous.
 *
 * Relevé de 15 à 25 secondes : à travers un tunnel, chaque requête coûte un
 * aller-retour hors du réseau local, et la vérification de session initiale
 * dépassait la fenêtre. Un test qui patiente ne coûte du temps que lorsque
 * quelque chose est réellement cassé.
 */
const ATTENTE = 25000

const txt = () => page.evaluate(() => document.body.innerText)
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))

const attendre = async (attendu, timeout = ATTENTE) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txt(), attendu)) return true
    await pause(150)
  }
  return false
}

const clic = async (filtre, timeout = ATTENTE) => {
  const limite = Date.now() + timeout
  let fait = false
  while (Date.now() < limite && !fait) {
    fait = await page.evaluate((f) => {
      const els = [...document.querySelectorAll('button, a, label')]
      const el = els.find((e) => e.innerText.trim() === f) ?? els.find((e) => e.innerText.includes(f))
      if (!el || el.disabled) return false
      el.click()
      return true
    }, filtre)
    if (!fait) await pause(150)
  }
  if (!fait) throw new Error(`introuvable ou désactivé : ${filtre}`)
  await pause(300)
}

/**
 * Saisit un champ repéré par son libellé.
 *
 * React ignore une valeur posée directement sur `input.value` : il faut passer
 * par le setter natif du prototype puis émettre l'événement, sinon le state du
 * formulaire reste vide et l'envoi part sans les champs.
 */
const remplir = (libelle, valeur) => page.evaluate(([l, v]) => {
  const label = [...document.querySelectorAll('label')]
    .find((e) => e.querySelector('span')?.innerText.trim() === l)
  if (!label) throw new Error(`champ introuvable : ${l}`)
  const champ = label.querySelector('input, select')
  const proto = champ.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(champ, v)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
  champ.dispatchEvent(new Event('change', { bubbles: true }))
}, [libelle, valeur])

const connecter = async (identifiant, motDePasse) => {
  await page.waitForSelector('#username', { timeout: 25000 })
  await page.type('#username', identifiant)
  await page.type('#password', motDePasse)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
    page.click('#kc-login'),
  ])
  await pause(2000)
}

/* ------------------------------------------------------------------ *
 * 1. Un conseiller référence l'établissement.
 * ------------------------------------------------------------------ */
console.log('─── L\'équipe référence un salon ────────────────────')
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' })
await clic('Se connecter')
await connecter('admin', 'admin')

// L'administration ouvre sur la file des demandes : on travaille ce qui
// attend avant d'installer. Le référencement direct — démarchage sans demande
// préalable — est l'onglet voisin.
dire(await attendre('Demandes'), 'l\'administration ouvre sur la file des demandes')
await clic('Référencer')
dire(await attendre('Référencer un salon'),
  'le référencement direct reste accessible, pour un salon démarché')
dire(contient(await txt(), 'choisir son mot de passe'),
  'l\'écran annonce que le gérant définira son mot de passe lui-même')

await remplir('Nom du salon', SALON)
await remplir('Ville', 'Tanger')
await remplir('Adresse', '14 rue de Fès')
await remplir('Quartier', 'Iberia')
await remplir('Téléphone du salon', '0539112233')
await remplir('Prénom', 'Yasmine')
await remplir('Nom', 'Benali')
await remplir('E-mail', GERANT)
await remplir('Téléphone', '0661998877')

await clic('Référencer le salon')
dire(await attendre('est référencé'), 'le salon est créé en un seul envoi')
const compteRendu = await txt()
dire(contient(compteRendu, GERANT), 'l\'écran rappelle l\'identifiant du gérant')
dire(contient(compteRendu, 'e-mail') || contient(compteRendu, 'mot de passe'),
  'l\'écran indique ce que le gérant va recevoir')
dire(!/mot de passe\s*:\s*\S/i.test(compteRendu),
  'aucun mot de passe n\'est affiché au conseiller')

dire(await attendre(SALON), 'le salon apparaît aussitôt dans la liste « En ligne »')

/* ------------------------------------------------------------------ *
 * 2. L'invitation part vraiment.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── L\'invitation reçue par le gérant ───────────────')

const chercherMail = async () => {
  const limite = Date.now() + 20000
  while (Date.now() < limite) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${GERANT}`)}`)
    const { messages = [] } = await r.json()
    if (messages.length > 0) {
      return (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json())
    }
    await pause(500)
  }
  return null
}

const mail = await chercherMail()
if (!dire(mail !== null, `un e-mail est arrivé à ${GERANT}`)) {
  console.log('\n   Aucun e-mail : la suite du parcours ne peut pas être vérifiée.')
  await browser.close()
  process.exit(1)
}

const corps = `${mail.HTML ?? ''}\n${mail.Text ?? ''}`
dire(/[à§é]|Booking/i.test(mail.Subject), `objet en français : « ${mail.Subject} »`)
dire(!/mot de passe\s*(provisoire|temporaire)?\s*[:=]\s*\S+/i.test(mail.Text ?? ''),
  'l\'e-mail ne contient aucun mot de passe en clair')

const lien = (corps.match(/https?:\/\/[^\s"'<>]*action-token[^\s"'<>]*/) ?? [])[0]
  ?.replaceAll('&amp;', '&')
dire(Boolean(lien), 'l\'e-mail porte un lien à usage unique, non un identifiant')

/* ------------------------------------------------------------------ *
 * 3. Le gérant choisit son mot de passe et trouve son salon.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Le gérant prend la main ────────────────────────')

/**
 * Un navigateur distinct, et non un simple onglet.
 *
 * Le gérant n'est pas le conseiller. Ouvrir son lien d'invitation dans le
 * navigateur où l'admin est connecté fait répondre à Keycloak « vous êtes
 * déjà authentifié en tant qu'un autre utilisateur » : le parcours n'est
 * jamais celui du gérant, et le test mesurait autre chose que la réalité.
 */
const navigateurGerant = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})
const gerant = await navigateurGerant.newPage()
await gerant.setViewport({ width: 1280, height: 1000 })
await gerant.setCacheEnabled(false)
await gerant.goto(lien, { waitUntil: 'networkidle0' })

const txtG = () => gerant.evaluate(() => document.body.innerText)

// Keycloak n'exécute pas un jeton reçu par e-mail sans un geste explicite :
// il présente d'abord ce qui va se passer. C'est une protection, pas un
// accident — le parcours doit donc franchir cette marche.
const intermediaire = await txtG()
if (!dire(await gerant.$('#password-new') === null && /continuer/i.test(intermediaire),
  'le lien mène à une page qui annonce l\'action avant de l\'exécuter')) {
  console.log('     page obtenue :', JSON.stringify(intermediaire.slice(0, 300)))
}
dire(contient(intermediaire, 'mot de passe'),
  'cette page dit ce qui est demandé : choisir un mot de passe')
dire(contient(intermediaire, 'Booking'), 'elle porte la marque, pas celle de l\'outil')
await Promise.all([
  gerant.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  gerant.evaluate(() => [...document.querySelectorAll('a')]
    .find((a) => /continuer/i.test(a.innerText) && !/kc_locale/.test(a.href))?.click()),
])
/*
 * waitForSelector, et non une interrogation immédiate du DOM.
 *
 * Le clic déclenche une navigation. Une pause fixe suffisait en local ; avec
 * la latence d'un tunnel, la page changeait encore au moment de la question
 * et Puppeteer levait « Execution context was destroyed », interrompant la
 * suite au milieu. waitForSelector traverse la navigation.
 */
const atteint = await gerant.waitForSelector('#password-new', { timeout: 25000 })
  .then(() => true).catch(() => false)
dire(atteint, 'le choix du mot de passe est atteint')
const accueil = await txtG()
dire(contient(accueil, 'mot de passe') && !contient(accueil, 'password'),
  'le formulaire est en français')

await gerant.type('#password-new', MOT_DE_PASSE)
await gerant.type('#password-confirm', MOT_DE_PASSE)
await Promise.all([
  gerant.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  gerant.evaluate(() => document.querySelector('form').requestSubmit()),
])
await pause(1500)

const confirmation = await txtG()
dire(contient(confirmation, 'enregistré') || contient(confirmation, 'mis à jour'),
  'le mot de passe est accepté et confirmé')

// Keycloak ne redirige jamais seul après une action détachée : il propose le
// retour. Ce lien est la dernière marche du parcours — s'il manque, le gérant
// est arrivé au bout sans savoir où aller.
/*
 * Le lien de retour se reconnaît à ce qu'il n'est pas.
 *
 * Deux tentatives ratées avant celle-ci : « contient :5173 » ne voyait plus
 * rien dès que le site changeait de port, et « commence par l'origine du
 * site » attrapait le sélecteur de langue — car derrière un proxy unique,
 * Keycloak partage justement cette origine. Restent les marqueurs propres à
 * ses pages, valables quelle que soit la topologie.
 */
const KEYCLOAK = /\/realms\/|\/login-actions\/|kc_locale=/
const retour = await gerant.evaluate((motif) =>
  [...document.querySelectorAll('a')]
    .map((a) => a.href)
    .find((h) => h && !new RegExp(motif).test(h)) ?? null,
  KEYCLOAK.source)
dire(retour !== null, `le retour vers l'application est proposé (${retour ?? 'absent'})`)

await gerant.goto(retour, { waitUntil: 'networkidle0' })

// Le lien porte l'adresse du gérant : l'application ouvre la connexion
// d'elle-même, identifiant déjà renseigné. Il ne lui reste que le mot de
// passe qu'il vient de choisir.
const limite = Date.now() + 20000
let formulaire = null
let dedans = false
while (Date.now() < limite && !formulaire && !dedans) {
  formulaire = await gerant.$('#username').catch(() => null)
  dedans = contient(await txtG().catch(() => ''), SALON)
  if (!formulaire && !dedans) await pause(200)
}

if (formulaire) {
  const prerempli = await gerant.$eval('#username', (e) => e.value)
  dire(prerempli === GERANT,
    `la connexion s'ouvre seule, identifiant déjà renseigné (${prerempli || 'vide'})`)
  await gerant.type('#password', MOT_DE_PASSE)
  await Promise.all([
    gerant.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
    gerant.click('#kc-login'),
  ])
  await pause(2500)
  const fin = Date.now() + 15000
  while (Date.now() < fin && !dedans) {
    dedans = contient(await txtG(), SALON)
    if (!dedans) await pause(200)
  }
} else {
  console.log('   · session reprise sans ressaisie')
}
dire(dedans, `le gérant arrive dans son espace et y voit « ${SALON} »`)
dire(!/bienvenue=/.test(gerant.url()),
  'son adresse ne reste pas dans la barre d\'URL')

/* ------------------------------------------------------------------ *
 * 4. Le salon est réservable par le public.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Visible côté client ────────────────────────────')
const recherche = await (await fetch(
  `${API}/api/public/salons?q=${encodeURIComponent(SALON)}&size=10`)).json()
const trouve = (recherche.content ?? []).find((s) => s.nom === SALON)
dire(Boolean(trouve), 'le salon mis en ligne est trouvable dans la recherche publique')
dire(trouve?.ville === 'Tanger', 'sa ville est celle saisie par le conseiller')

/* ------------------------------------------------------------------ *
 * Cloisonnement : le nouveau gérant ne voit que son salon.
 * ------------------------------------------------------------------ */
const jeton = await (await fetch(
  `${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', username: GERANT, password: MOT_DE_PASSE, grant_type: 'password',
    }),
  })).json()
const siens = await (await fetch(`${API}/api/salons/me`, {
  headers: { Authorization: `Bearer ${jeton.access_token}` },
})).json()
dire(Array.isArray(siens) && siens.length === 1 && siens[0].nom === SALON,
  `il ne gère que son salon (${Array.isArray(siens) ? siens.length : '?'} salon)`)

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await navigateurGerant.close()
await browser.close()
console.log()
console.log(echecs === 0 ? '✅ Parcours de référencement complet.' : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
