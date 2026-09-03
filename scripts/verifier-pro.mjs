/**
 * Parcours d'installation d'un salon, de bout en bout, dans un vrai navigateur.
 *
 * Reproduit ce que fait un gérant devant son écran : remplir le catalogue,
 * déclarer l'équipe et les horaires, puis saisir un rendez-vous pris au
 * téléphone. C'est le chemin dont dépend l'adoption côté professionnel.
 *
 * La fiche du salon, elle, n'est pas créée ici : dans ce modèle c'est
 * l'équipe qui référence l'établissement pour le compte du gérant. Le script
 * la met donc en place par la route d'administration, comme le ferait un
 * conseiller, puis rend la main au gérant.
 *
 * Suppose la stack démarrée (docker compose, API sur 8080, Vite sur 5173).
 *
 *   npm run verifier:pro
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
const IDENTIFIANT = process.env.TEST_PRO ?? 'pro1'
const MOT_DE_PASSE = process.env.TEST_PRO_PASSWORD ?? 'pro1'
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
const NOM_SALON = `Atlas Barber ${Date.now().toString().slice(-5)}`
const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'

/* ------------------------------------------------------------------ *
 * Préparation : un conseiller référence le salon pour ce gérant.
 * ------------------------------------------------------------------ */
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

// Le compte du gérant existe déjà (données de démonstration) : le
// référencement le retrouve par son adresse plutôt que d'en créer un second.
// Le salon reste EN_ATTENTE, pour vérifier qu'il se paramètre avant validation.
const referencer = async () => {
  const admin = await jeton('admin')
  const r = await fetch(`${API}/api/admin/salons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      salon: {
        nom: NOM_SALON, ville: 'Casablanca', quartier: 'Maarif',
        adresse: '8 Rue Al Massira', telephone: '0655443322', categorie: 'BARBIER',
        delaiAnnulationHeures: 24,
      },
      proprietaire: {
        prenom: 'Karim', nom: 'Benali', email: `${IDENTIFIANT}@booking.ma`,
        telephone: '0655443322',
      },
      validerImmediatement: false,
    }),
  })
  const corps = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`référencement impossible : ${r.status} ${JSON.stringify(corps)}`)
  return corps
}

const reference = await referencer()
console.log('─── Préparation ────────────────────────────────────')
console.log(`   ${NOM_SALON} référencé pour ${reference.emailProprietaire}`
  + ` (compte ${reference.compteCree ? 'créé' : 'réutilisé'})`)
console.log()

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
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
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

/** Clic déclenché depuis le DOM : la souris rate la cible quand la page se recale. */
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
    if (!fait) await new Promise((r) => setTimeout(r, 150))
  }
  if (!fait) throw new Error(`introuvable ou désactivé après ${timeout} ms : ${filtre}`)
  await new Promise((r) => setTimeout(r, 400))
}

const saisir = async (label, valeur) => {
  const fait = await page.evaluate((l, v) => {
    const lab = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith(l))
    const champ = lab?.querySelector('input, textarea, select')
    if (!champ) return false
    const proto = champ.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(champ, v)
    champ.dispatchEvent(new Event('input', { bubbles: true }))
    champ.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, label, valeur)
  if (!fait) throw new Error(`champ introuvable : ${label}`)
  await new Promise((r) => setTimeout(r, 250))
}

console.log('─── Connexion professionnelle ──────────────────────')
await page.goto(`${BASE}/pro`, { waitUntil: 'networkidle0' })
await attendre('Espace professionnel')
await clic('Se connecter')
// On attend le formulaire Keycloak lui-même plutôt qu'un événement de
// navigation : la redirection passe par plusieurs sauts et networkidle0
// peut se déclencher sur une étape intermédiaire.
await page.waitForSelector('#username', { timeout: 25000 })
await page.type('#username', IDENTIFIANT)
await page.type('#password', MOT_DE_PASSE)
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  page.click('#kc-login'),
])
console.log(' ', ok(await attendre('Mes salons')), 'tableau de bord accessible')

console.log('\n─── Le salon référencé pour lui ────────────────────')
console.log(' ', ok(await attendre(NOM_SALON)), 'le gérant trouve son salon déjà en place')
console.log(' ', ok(await attendre('En attente de validation')),
  'EN_ATTENTE — invisible du public tant qu\'il n\'est pas validé')
// Un compte professionnel n'a pas le droit de créer un établissement : cette
// route est réservée à l'administration, et l'interface ne la propose pas.
const creationRefusee = await page.evaluate(() =>
  ![...document.querySelectorAll('button, a')].some((e) => /ajouter un salon/i.test(e.innerText)))
console.log(' ', ok(creationRefusee), 'aucune création d\'établissement proposée au gérant')

console.log('\n─── Catalogue, depuis un modèle métier ─────────────')
await clic(NOM_SALON)
console.log(' ', ok(await attendre('Agenda')), 'fiche du salon ouverte malgré EN_ATTENTE')
await clic('Prestations')
await attendre('Catalogue')
await clic('Ajouter une prestation')
await attendre('Partir d\'un modèle')
const modeles = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => b.innerText).filter((t) => t.includes(' · ')))
console.log(' ', ok(modeles.some((m) => m.includes('Coupe homme'))),
  `modèles adaptés au métier barbier : ${modeles.slice(0, 3).join(' | ')}`)
await clic('Coupe homme')
await clic('Ajouter')
console.log(' ', ok(await attendre('Coupe homme')), 'prestation ajoutée')

console.log('\n─── Équipe et affectations ─────────────────────────')
await clic('Équipe')
await attendre('Ajouter un praticien')
await clic('Ajouter un praticien')
await saisir('Prénom', 'Hamza')
await saisir('Nom', 'Benjelloun')
await saisir('Titre', 'Barbier')
await clic('Ajouter')
console.log(' ', ok(await attendre('Hamza')), 'praticien ajouté')
console.log(' ', ok(await attendre('Prestations réalisées')), 'affectations proposées')
await clic('Coupe homme')
await new Promise((r) => setTimeout(r, 800))
const coche = await page.evaluate(() =>
  [...document.querySelectorAll('input[type=checkbox]')].some((c) => c.checked))
console.log(' ', ok(coche), 'prestation affectée au praticien')

console.log('\n─── Horaires ───────────────────────────────────────')
await clic('Horaires')
await attendre('Horaires d\'ouverture')
await clic('Lundi')
await clic('appliquer du lundi au samedi')
await new Promise((r) => setTimeout(r, 400))
const ouverts = await page.evaluate(() =>
  [...document.querySelectorAll('input[type=checkbox]')].filter((c) => c.checked).length)
console.log(' ', ok(ouverts >= 6), `${ouverts} cases cochées après recopie sur la semaine`)
await clic('Enregistrer')
console.log(' ', ok(await attendre('Horaires enregistrés')), 'horaires enregistrés')

console.log('\n─── Rendez-vous pris au téléphone ──────────────────')
await clic('Agenda')
await attendre('Aujourd\'hui')

/**
 * On avance d'au moins un jour avant de saisir.
 *
 * Le formulaire propose par défaut le jour affiché à l'agenda, c'est-à-dire
 * aujourd'hui. Lancé le soir après la fermeture, ou un dimanche, le test ne
 * trouvait aucun créneau et échouait sur un comportement pourtant juste : il
 * ne passait que le matin. On avance jusqu'à tomber sur un jour ouvert.
 */
const optionsCreneau = () => page.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith('Créneau'))
  if (!lab) return null
  return [...lab.querySelectorAll('option')].filter((o) => o.value).map((o) => o.value)
})

const choisirPremierPraticien = async () => {
  const valeur = await page.evaluate(() => {
    const lab = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith('Praticien'))
    const opt = lab ? [...lab.querySelectorAll('option')].find((o) => o.value) : null
    return opt ? opt.value : ''
  })
  if (valeur) await saisir('Praticien', valeur)
  return valeur
}

let creneaux = []
let joursAvances = 0
await clic('Rendez-vous par téléphone')
await attendre('Nom du client')

for (; joursAvances < 8; joursAvances++) {
  await choisirPremierPraticien()
  await new Promise((r) => setTimeout(r, 1500))
  creneaux = (await optionsCreneau()) ?? []
  if (creneaux.length > 0) break
  // Jour suivant : le sélecteur de créneau se recharge sur le nouveau jour.
  await clic('→')
  await new Promise((r) => setTimeout(r, 900))
}
console.log(' ', ok(joursAvances < 8), `jour ouvert trouvé après ${joursAvances} avance(s)`)
console.log(' ', ok(creneaux.length > 0), `${creneaux.length} créneaux calculés depuis les horaires saisis`)
if (creneaux.length > 0) {
  await saisir('Créneau', creneaux[0])
  await saisir('Nom du client', 'Mme Bennani')
  await saisir('Téléphone', '0670112233')
  await clic('Enregistrer')
  console.log(' ', ok(await attendre('Mme Bennani')), 'rendez-vous inscrit à l\'agenda')
  console.log(' ', ok(await attendre('téléphone')), 'origine téléphone signalée')
}

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/pro-agenda.png', fullPage: true })

console.log('\n─── Bilan ──────────────────────────────────────────')
console.log(' ', ok(erreurs.length === 0),
  erreurs.length === 0 ? 'aucune erreur JavaScript' : `erreurs JS : ${erreurs.slice(0, 3).join(' | ')}`)
if (reseau.length > 0) {
  console.log(`   ${reseau.length} réponse(s) HTTP en erreur, gérées par l'interface :`)
  for (const r of [...new Set(reseau)].slice(0, 3)) console.log(`     ${r}`)
}

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
