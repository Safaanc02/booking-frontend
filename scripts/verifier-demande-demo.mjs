/**
 * Prise de contact d'un professionnel, du formulaire public à la file
 * commerciale, dans un vrai navigateur.
 *
 * Ce parcours n'existe que parce qu'un salon ne s'inscrit pas : il se
 * manifeste, et l'équipe l'installe. Ce qui est vérifié ici n'est donc pas
 * « le formulaire s'envoie » mais la chaîne entière — qualification recueillie,
 * aucun compte créé, demande visible et pilotable par l'administration.
 *
 * Suppose la stack démarrée (docker compose + API + Vite).
 *
 *   npm run verifier:demande-demo
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
const KC = process.env.KC_URL ?? 'http://localhost:8081'
const ok = (c) => (c ? '✅' : '❌')

const SUFFIXE = Date.now().toString().slice(-6)
const SALON = `Institut Chaimae ${SUFFIXE}`
const EMAIL = `chaimae.${SUFFIXE}@example.ma`

let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const jeton = async (identifiant) => {
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', username: identifiant, password: identifiant,
      grant_type: 'password',
    }),
  })
  if (!r.ok) throw new Error(`authentification ${identifiant} impossible (${r.status})`)
  return (await r.json()).access_token
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1100 })
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

const txt = () => page.evaluate(() => document.body.innerText)
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))
const attendre = async (attendu, timeout = 15000) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txt(), attendu)) return true
    await pause(150)
  }
  return false
}
const clic = async (filtre, timeout = 15000) => {
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
  await pause(250)
}
/** React ignore une valeur posée sur input.value : il faut le setter natif. */
const remplir = (libelle, valeur) => page.evaluate(([l, v]) => {
  const label = [...document.querySelectorAll('label')]
    .find((e) => e.querySelector('span')?.innerText.trim() === l)
  if (!label) throw new Error(`champ introuvable : ${l}`)
  const champ = label.querySelector('input, select, textarea')
  const proto = champ.tagName === 'SELECT' ? HTMLSelectElement.prototype
    : champ.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(champ, v)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
  champ.dispatchEvent(new Event('change', { bubbles: true }))
}, [libelle, valeur])
/**
 * Clic dans la carte d'une demande précise.
 *
 * Viser « le bouton Qualifiée » ne suffit pas : une file contient toutes les
 * demandes des exécutions précédentes, et le premier bouton trouvé appartient
 * à une autre ligne. Le test pilotait ainsi la demande de quelqu'un d'autre —
 * en concluant à tort que le produit était en défaut.
 */
const clicDansDemande = async (id, libelle, timeout = 15000) => {
  const limite = Date.now() + timeout
  let fait = false
  while (Date.now() < limite && !fait) {
    fait = await page.evaluate(([i, l]) => {
      const carte = document.querySelector(`[data-demande-id="${i}"]`)
      if (!carte) return false
      const els = [...carte.querySelectorAll('button, a')]
      const el = els.find((e) => e.innerText.trim() === l)
        ?? els.find((e) => e.innerText.includes(l))
      if (!el || el.disabled) return false
      el.click()
      return true
    }, [id, libelle])
    if (!fait) await pause(150)
  }
  if (!fait) throw new Error(`introuvable dans la demande #${id} : ${libelle}`)
  await pause(400)
}

const attendreDemande = async (id, timeout = 15000) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (await page.$(`[data-demande-id="${id}"]`)) return true
    await pause(150)
  }
  return false
}

const texteDemande = (id) => page.evaluate(
  (i) => document.querySelector(`[data-demande-id="${i}"]`)?.innerText ?? '', id)

const boutonActif = (libelle) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().startsWith(l))
  return Boolean(b) && !b.disabled
}, libelle)

/* ------------------------------------------------------------------ *
 * 1. Un gérant trouve l'entrée professionnelle et se manifeste.
 * ------------------------------------------------------------------ */
console.log('─── Un salon demande une démonstration ─────────────')
await page.goto(BASE, { waitUntil: 'networkidle0' })
dire(await attendre('Vous êtes un salon'),
  'l\'entrée professionnelle est proposée depuis l\'accueil')

await clic('Vous êtes un salon')
dire(await attendre('installé par nos soins'),
  'la page annonce que l\'installation est faite pour lui')
const argumentaire = await txt()
dire(contient(argumentaire, 'aucune commission'),
  'l\'absence de commission est affichée avant le formulaire')
// Restreint au contenu de la page : l'en-tête du site propose « Inscription »
// aux clients qui réservent, ce qui est le parcours voulu. Le mesurer ici
// faisait échouer une assertion pourtant juste.
const contenu = await page.evaluate(() => document.querySelector('main').innerText)
dire(!contient(contenu, 'créer un compte') && !contient(contenu, 'inscription')
  && !contient(contenu, 's\'inscrire'),
  'la page ne propose aucune inscription professionnelle : ce n\'est pas le modèle')

/* Étape 1 — l'établissement. */
dire(!await boutonActif('Continuer'),
  'on ne peut pas avancer sans avoir renseigné l\'établissement')
await clic('Esthétique')
await remplir('Nom de l\'établissement', SALON)
await remplir('Ville', 'Rabat')
await remplir('Quartier', 'Agdal')
await remplir('Votre spécialité', 'soins du visage et épilation')
dire(await boutonActif('Continuer'), 'l\'étape suivante s\'ouvre une fois le métier choisi')
await clic('Continuer')

/* Étape 2 — la qualification. */
dire(await attendre('Depuis combien de temps'), 'la qualification est demandée à part')
dire(!await boutonActif('Continuer'), 'l\'ancienneté est obligatoire')
await clic('Plus de trois ans')
await remplir('Combien êtes-vous à travailler ?', '6')
await remplir('Le local vous appartient ?', 'non')
await clic('Carnet papier')
await clic('Continuer')

/* Étape 3 — le contact. */
dire(await attendre('Prénom'), 'les coordonnées ne sont demandées qu\'en dernier')
await remplir('Prénom', 'Chaimae')
await remplir('Nom', 'Ouazzani')
await remplir('Téléphone', '0612')
dire(!await boutonActif('Demander'),
  'un numéro incomplet n\'ouvre pas l\'envoi')
await remplir('Téléphone', '0663445566')
await remplir('E-mail', EMAIL)
await remplir('ICE (facultatif)', '001234567000078')
await remplir('Un mot sur votre besoin', 'Je perds des appels le samedi.')
dire(await boutonActif('Demander'), 'l\'envoi s\'ouvre quand le contact est complet')
await clic('Demander une démonstration')

dire(await attendre('C\'est noté, Chaimae'), 'la confirmation nomme le demandeur')
const confirmation = await txt()
dire(contient(confirmation, '48 heures'), 'elle annonce un délai de rappel')
dire(contient(confirmation, 'rien à préparer') || contient(confirmation, 'rien à saisir'),
  'elle rassure sur ce qu\'il n\'aura pas à faire')
dire(!contient(confirmation, 'mot de passe') && !contient(confirmation, 'connect'),
  'aucun compte n\'a été créé, et rien ne le suggère')

/* ------------------------------------------------------------------ *
 * 2. Aucun compte n'existe pour cette adresse.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Ce que la demande n\'a pas fait ────────────────')
const connexion = await fetch(
  `${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', username: EMAIL, password: EMAIL, grant_type: 'password',
    }),
  })
dire(!connexion.ok, `aucun compte utilisable pour ${EMAIL} (${connexion.status})`)

const publics = await (await fetch(
  `${API}/api/public/salons?q=${encodeURIComponent(SALON)}&size=10`)).json()
dire((publics.content ?? []).every((s) => s.nom !== SALON),
  'aucun salon n\'est apparu côté client')

/* ------------------------------------------------------------------ *
 * 3. L'équipe la voit, la qualifie, la fait avancer.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── La file commerciale ────────────────────────────')
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' })
await clic('Se connecter')
await page.waitForSelector('#username', { timeout: 25000 })
await page.type('#username', 'admin')
await page.type('#password', 'admin')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  page.click('#kc-login'),
])
await pause(2500)

// L'identifiant vient de l'API : c'est le seul moyen de désigner à coup sûr
// la demande de cette exécution parmi celles qui traînent.
const admin = await jeton('admin')
const nouvelles = await (await fetch(`${API}/api/admin/demandes-demo?statut=NOUVELLE&size=100`,
  { headers: { Authorization: `Bearer ${admin}` } })).json()
const ID = (nouvelles.content ?? []).find((d) => d.email === EMAIL)?.id
if (!dire(Boolean(ID), 'la demande est enregistrée et identifiable')) {
  await browser.close()
  process.exit(1)
}

dire(await attendreDemande(ID), 'la demande arrive dans l\'onglet des demandes')
const fiche = await texteDemande(ID)
dire(contient(fiche, 'plus de 3 ans') && contient(fiche, '6 personnes'),
  'la qualification est lisible sans un clic de plus')
dire(contient(fiche, 'locataire'), 'le statut du local est rappelé')
dire(contient(fiche, 'carnet papier'), 'l\'outil actuel est rappelé')
dire(contient(fiche, '001234567000078'), 'l\'ICE est repris tel quel')
dire(contient(fiche, EMAIL) && contient(fiche, '06 63 44 55 66'),
  'les coordonnées sont directement actionnables')

// Le suivi n'a de valeur que s'il survit au changement de file.
await page.evaluate(([i, note]) => {
  const champ = document.querySelector(`[data-demande-id="${i}"] input`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(champ, note)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}, [ID, 'Rappelée, visite prévue jeudi 14h'])
await clicDansDemande(ID, 'Contactée')
await pause(1200)
dire(!await page.$(`[data-demande-id="${ID}"]`),
  'traitée, elle quitte la file des nouvelles')

await clic('Contactées')
dire(await attendreDemande(ID), 'elle se retrouve dans la file suivante')
const suivie = await texteDemande(ID)
dire(contient(suivie, 'visite prévue jeudi'), 'la note de suivi a été conservée')
dire(contient(suivie, 'admin'), 'on sait qui l\'a traitée')
dire(contient(suivie, 'Qualifiée'), 'l\'étape suivante est proposée, pas toutes')

/* Le décompte de l'onglet suit le traitement. */
const restantes = await (await fetch(`${API}/api/admin/demandes-demo/nouvelles`, {
  headers: { Authorization: `Bearer ${admin}` },
})).json()
dire(typeof restantes === 'number', `le décompte des nouvelles est exposé (${restantes})`)

/* ------------------------------------------------------------------ *
 * 4. Le garde anti-doublon.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Garde anti-doublon ─────────────────────────────')
const renvoi = await fetch(`${API}/api/public/demandes-demo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomEtablissement: SALON, typeEtablissement: 'ESTHETIQUE', ville: 'Rabat',
    anciennete: 'PLUS_3_ANS', prenom: 'Chaimae', telephone: '0663445566', email: EMAIL,
  }),
})
dire(renvoi.status === 202,
  'un renvoi immédiat reçoit la même réponse — la route ne dit pas qui a écrit')
const toutes = await Promise.all(
  ['NOUVELLE', 'CONTACTEE', 'QUALIFIEE', 'CONVERTIE', 'PERDUE'].map((s) =>
    fetch(`${API}/api/admin/demandes-demo?statut=${s}&size=100`, {
      headers: { Authorization: `Bearer ${admin}` },
    }).then((r) => r.json())))
const occurrences = toutes
  .flatMap((p) => p.content ?? [])
  .filter((d) => d.email === EMAIL).length
dire(occurrences === 1, `une seule demande enregistrée pour cette adresse (${occurrences})`)

/* ------------------------------------------------------------------ *
 * 5. La boucle se referme : la demande devient un salon.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── De la demande au salon ─────────────────────────')
await clicDansDemande(ID, 'Qualifiée')
await pause(1000)
await clic('Qualifiées')
dire(await attendreDemande(ID), 'la demande qualifiée attend son installation')
dire(!/convertie/i.test(await texteDemande(ID)),
  'la conversion ne se pose pas à la main : elle vient du référencement')

await clicDansDemande(ID, 'Référencer le salon')
dire(await attendre('Prérempli depuis la demande'),
  'le formulaire s\'ouvre en reprenant ce que la demande a recueilli')
const prerempli = await page.evaluate(() => {
  const lire = (l) => [...document.querySelectorAll('label')]
    .find((e) => e.querySelector('span')?.innerText.trim() === l)
    ?.querySelector('input, select')?.value
  return {
    nom: lire('Nom du salon'), ville: lire('Ville'),
    email: lire('E-mail'), categorie: lire('Activité'),
  }
})
dire(prerempli.nom === SALON && prerempli.ville === 'Rabat',
  'l\'établissement est repris tel quel')
dire(prerempli.email === EMAIL, 'le gérant est repris comme propriétaire')
dire(prerempli.categorie === 'ESTHETIQUE',
  `le métier déclaré devient la catégorie du salon (${prerempli.categorie})`)

// Seule l'adresse manquait : la demande ne la réclame pas, pour ne pas
// alourdir un formulaire public.
await remplir('Adresse', '22 avenue Fal Ould Oumeir')
await clic('Référencer le salon')
dire(await attendre('est référencé'), 'le salon est créé depuis la demande')

await clic('Demandes')
await clic('Converties')
dire(await attendreDemande(ID), 'la demande a basculé en convertie, sans intervention')
dire(contient(await texteDemande(ID), 'Référencé sous'),
  'elle porte le salon auquel elle a mené — le rendement du formulaire est mesurable')

const converties = await (await fetch(
  `${API}/api/admin/demandes-demo?statut=CONVERTIE&size=100`,
  { headers: { Authorization: `Bearer ${admin}` } })).json()
const notre = (converties.content ?? []).find((d) => d.email === EMAIL)
dire(Boolean(notre?.salonId), `la demande pointe vers le salon #${notre?.salonId ?? '?'}`)

const enLigne = await (await fetch(
  `${API}/api/public/salons?q=${encodeURIComponent(SALON)}&size=10`)).json()
dire((enLigne.content ?? []).some((x) => x.nom === SALON),
  'le salon est visible côté client')

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await browser.close()
console.log()
console.log(echecs === 0 ? '✅ Parcours de prise de contact complet.' : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
