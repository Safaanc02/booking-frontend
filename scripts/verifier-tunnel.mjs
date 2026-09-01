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
const BASE = 'http://localhost:5173'
const ok = (c) => (c ? '✅' : '❌')

// Compte de démonstration du realm Keycloak importé par docker compose.
const IDENTIFIANT = process.env.TEST_USER ?? 'client1'
const MOT_DE_PASSE = process.env.TEST_PASSWORD ?? 'client1'

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })

const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()) })

const txt = () => page.evaluate(() => document.body.innerText)
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
const attendre = async (attendu, timeout = 15000) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txt(), attendu)) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

/** Attend que des créneaux horaires soient rendus, et les renvoie. */
const attendreCreneaux = async (timeout = 15000) => {
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
const clic = async (filtre, timeout = 15000) => {
  const limite = Date.now() + timeout
  let fait = false
  while (Date.now() < limite && !fait) {
    fait = await page.evaluate((f) => {
      const els = [...document.querySelectorAll('button, a')]
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

console.log('─── Étape 1 : choix de la prestation ───────────────')
await page.goto(`${BASE}/salon/1/reserver`, { waitUntil: 'networkidle0' })
console.log(' ', ok(await attendre('Quelle prestation')), 'titre affiché')
let t = await txt()
console.log(' ', ok(t.includes('Coupe femme') && t.includes('Balayage')), 'les 2 prestations listées')
console.log(' ', ok(t.includes('200,00') && t.includes('650,00')), 'prix en MAD')

console.log('\n─── Étape 2 : choix du praticien ───────────────────')
await clic('Coupe femme')
console.log(' ', ok(await attendre('Avec qui')), 'titre affiché')
t = await txt()
console.log(' ', ok(t.includes('Sans préférence')), '« sans préférence » proposé par défaut')
console.log(' ', ok(t.includes('Sofia') && t.includes('Youssef')), 'les 2 praticiens de la coupe')

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
const dispos = await attendreCreneaux()
const retenu = dispos[dispos.length - 1]
await clic(retenu)

await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  clic('Se connecter et confirmer'),
])
await new Promise((r) => setTimeout(r, 1000))
console.log(' ', ok(page.url().includes(':8081')), 'redirigé vers Keycloak')

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
console.log(' ', ok(contient(t, 'À venir')), 'classée dans « à venir »')
console.log(' ', ok(t.includes('Confirmée')), 'statut CONFIRMEE')
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/compte.png' })

console.log('\n─── Annulation ─────────────────────────────────────')
await clic('Annuler')
await attendre('Historique')
t = await txt()
console.log(' ', ok(contient(t, 'Historique')), 'basculée dans l\'historique')
console.log(' ', ok(t.includes('Annulée')), 'statut ANNULEE_CLIENT')

console.log('\n─── Erreurs console ────────────────────────────────')
console.log(' ', ok(erreurs.length === 0), erreurs.length === 0 ? 'aucune' : erreurs.slice(0, 3).join(' | '))

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
