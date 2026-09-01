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
const clic = async (sel, filtre) => {
  const h = await page.evaluateHandle((sel, f) => {
    const els = [...document.querySelectorAll(sel)]
    return els.find((e) => !f || e.innerText.includes(f)) ?? null
  }, sel, filtre ?? null)
  const el = h.asElement()
  if (!el) throw new Error(`introuvable : ${sel} ${filtre ?? ''}`)
  await el.click()
  await new Promise((r) => setTimeout(r, 900))
}

console.log('─── Étape 1 : choix de la prestation ───────────────')
await page.goto(`${BASE}/salon/1/reserver`, { waitUntil: 'networkidle0' })
let t = await txt()
console.log(' ', ok(t.includes('Quelle prestation')), 'titre affiché')
console.log(' ', ok(t.includes('Coupe femme') && t.includes('Balayage')), 'les 2 prestations listées')
console.log(' ', ok(t.includes('200,00') && t.includes('650,00')), 'prix en MAD')

console.log('\n─── Étape 2 : choix du praticien ───────────────────')
await clic('button', 'Coupe femme')
t = await txt()
console.log(' ', ok(t.includes('Avec qui')), 'titre affiché')
console.log(' ', ok(t.includes('Sans préférence')), '« sans préférence » proposé par défaut')
console.log(' ', ok(t.includes('Sofia') && t.includes('Youssef')), 'les 2 praticiens de la coupe')

console.log('\n─── Étape 3 : choix du créneau ─────────────────────')
await clic('button', 'Sans préférence')
await new Promise((r) => setTimeout(r, 1600))
t = await txt()
console.log(' ', ok(t.includes('Quand ?')), 'titre affiché')
const creneaux = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => b.innerText).filter((s) => /^\d{2}:\d{2}$/.test(s)))
console.log(' ', ok(creneaux.length > 0), `${creneaux.length} créneaux — ${creneaux.slice(0, 6).join(' ')}…`)
const joursBarres = await page.evaluate(() =>
  [...document.querySelectorAll('button[disabled]')].filter((b) => b.className.includes('line-through')).length)
console.log(' ', ok(joursBarres > 0), `${joursBarres} jour(s) barré(s) — les dimanches et jours pleins`)

console.log('\n─── Étape 4 : récapitulatif ────────────────────────')
await clic('button', creneaux[0])
t = await txt()
console.log(' ', ok(t.includes('Récapitulatif')), 'titre affiché')
console.log(' ', ok(t.includes('Coupe femme')), 'prestation reprise')
console.log(' ', ok(t.includes('À régler sur place')), 'montant à régler sur place')
console.log(' ', ok(/Annulation gratuite jusqu'à \d+ h/.test(t)), 'politique d\'annulation affichée')
console.log(' ', ok(t.includes('Se connecter et confirmer')),
  'le compte n\'est demandé qu\'à la dernière étape')

console.log('\n─── Retour arrière via le fil d\'Ariane ─────────────')
await clic('button', 'Praticien')
t = await txt()
console.log(' ', ok(t.includes('Avec qui')), 'retour à l\'étape 2 sans tout perdre')

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/tunnel.png' })
await page.goto(`${BASE}/salon/1/reserver?prestationId=1`, { waitUntil: 'networkidle0' })
await clic('button', 'Sans préférence')
await new Promise((r) => setTimeout(r, 1600))
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/creneaux.png' })

console.log('\n─── Erreurs console ────────────────────────────────')
console.log(' ', ok(erreurs.length === 0), erreurs.length === 0 ? 'aucune' : erreurs.slice(0, 3).join(' | '))

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
