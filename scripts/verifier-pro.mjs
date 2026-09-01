/**
 * Parcours d'installation d'un salon, de bout en bout, dans un vrai navigateur.
 *
 * Reproduit ce que fait un gérant seul devant son écran : créer le salon,
 * remplir le catalogue, déclarer l'équipe et les horaires, puis saisir un
 * rendez-vous pris au téléphone. C'est le chemin dont dépend l'adoption côté
 * professionnel — s'il casse, aucun salon ne s'inscrit.
 *
 * Suppose la stack démarrée (docker compose, API sur 8080, Vite sur 5173).
 *
 *   npm run verifier:pro
 */
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5173'
const IDENTIFIANT = process.env.TEST_PRO ?? 'pro1'
const MOT_DE_PASSE = process.env.TEST_PRO_PASSWORD ?? 'pro1'
const ok = (c) => (c ? '✅' : '❌')
const NOM_SALON = `Atlas Barber ${Date.now().toString().slice(-5)}`

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()) })

const txt = () => page.evaluate(() => document.body.innerText)
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))

const attendre = async (attendu, timeout = 15000) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txt(), attendu)) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

/** Clic déclenché depuis le DOM : la souris rate la cible quand la page se recale. */
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

console.log('\n─── Création du salon ──────────────────────────────')
await clic('Ajouter un salon')
await attendre('Nouveau salon')
await saisir('Nom du salon', NOM_SALON)
await saisir('Ville', 'Casablanca')
await saisir('Adresse', '8 Rue Al Massira')
await saisir('Quartier', 'Maarif')
await saisir('Téléphone', '0655443322')
await saisir('Catégorie', 'BARBIER')
await clic('Créer le salon')
console.log(' ', ok(await attendre(NOM_SALON)), 'salon créé')
console.log(' ', ok(await attendre('En attente de validation')),
  'créé EN_ATTENTE — invisible du public tant qu\'il n\'est pas validé')

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
await clic('Rendez-vous par téléphone')
await attendre('Nom du client')
await saisir('Praticien', await page.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith('Praticien'))
  const opt = [...lab.querySelectorAll('option')].find((o) => o.value)
  return opt ? opt.value : ''
}))
await new Promise((r) => setTimeout(r, 1500))
const creneaux = await page.evaluate(() => {
  const lab = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith('Créneau'))
  return [...lab.querySelectorAll('option')].filter((o) => o.value).map((o) => o.value)
})
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

console.log('\n─── Erreurs console ────────────────────────────────')
console.log(' ', ok(erreurs.length === 0), erreurs.length === 0 ? 'aucune' : erreurs.slice(0, 3).join(' | '))

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
