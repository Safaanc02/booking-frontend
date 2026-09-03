/**
 * Page d'accueil, dans un vrai navigateur.
 *
 * Elle n'a l'air de rien à vérifier — aucune écriture, aucun compte — mais
 * c'est la seule page que tout le monde voit, et elle est presque entièrement
 * pilotée par des données réelles : le réseau, les villes couvertes, un salon
 * mis en avant et ses créneaux libres. Chacune de ces sources peut être vide,
 * lente ou absente, et la page doit rester présentable dans tous les cas.
 *
 *   npm run verifier:accueil
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
const ok = (c) => (c ? '✅' : '❌')

let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
await page.setCacheEnabled(false)

const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (!/Failed to load resource|net::ERR_/.test(t)) erreurs.push(t)
})

const txt = () => page.evaluate(() => document.body.innerText)
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))

await page.goto(BASE, { waitUntil: 'networkidle0' })
await pause(2200)

/* ------------------------------------------------------------------ *
 * 1. Ce que la page promet.
 * ------------------------------------------------------------------ */
console.log('─── Le bandeau d\'entrée ───────────────────────────')
const contenu = await txt()
dire(contient(contenu, 'sans un seul appel'), 'la promesse tient en une phrase')
dire(contient(contenu, 'à Casablanca'), 'l\'heure de référence est celle des salons')

/**
 * L'accroche doit dire la vérité sur l'heure qu'il est.
 *
 * Elle l'a déjà dite fausse : `Intl` rend l'heure seule sous la forme
 * « 01 h » en français, `Number` en tirait NaN, et la page annonçait des
 * salons ouverts à deux heures du matin — le contraire exact de ce qu'elle
 * démontre. On rejoue le calcul ici plutôt que de faire confiance au texte.
 */
const h = Number(new Intl.DateTimeFormat('fr-FR',
  { hour: '2-digit', hour12: false, timeZone: 'Africa/Casablanca' })
  .formatToParts(new Date()).find((p) => p.type === 'hour').value)
const ferme = h < 9 || h >= 19
dire(contient(contenu, ferme ? 'les salons sont fermés' : 'réservez sans décrocher'),
  `l'accroche correspond à l'heure réelle (${h} h, ${ferme ? 'fermé' : 'ouvert'})`)

/*
 * Aucun emoji : les pictogrammes sont dessinés, pas empruntés au système.
 *
 * On teste la présentation emoji, et non Extended_Pictographic : Unicode y
 * range aussi © ® ™, qui sont des symboles typographiques en texte normal —
 * le © du pied de page faisait échouer une page pourtant sans emoji. La
 * seconde branche rattrape les caractères neutres forcés en emoji par le
 * sélecteur de variante.
 */
const emoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u
const trouves = [...contenu].filter((c) => emoji.test(c))
dire(trouves.length === 0,
  `aucun emoji dans la page${trouves.length ? ` (${trouves.join(' ')})` : ''}`)
const glyphes = await page.evaluate(() => document.querySelectorAll('svg').length)
dire(glyphes >= 8, `les pictogrammes sont des tracés SVG (${glyphes})`)

/* ------------------------------------------------------------------ *
 * 2. Les chiffres annoncés sont ceux du réseau.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Des données réelles, pas des exemples ──────────')
const reseau = await (await fetch(`${API}/api/public/salons?size=50`)).json()
const villes = await (await fetch(`${API}/api/public/villes`)).json()
dire(contient(contenu, `${reseau.totalElements} salon`),
  `le nombre de salons annoncé est celui du serveur (${reseau.totalElements})`)
dire(villes.every((v) => contient(contenu, v)),
  `les villes affichées sont celles réellement couvertes (${villes.join(', ')})`)

/* Le salon mis en avant est le mieux noté, et ses créneaux sont libres. */
const attendu = [...(reseau.content ?? [])]
  .filter((s) => s.noteMoyenne && s.nombreAvis)
  .sort((a, b) => b.noteMoyenne - a.noteMoyenne)[0]
if (attendu) {
  dire(contient(contenu, attendu.nom),
    `le salon mis en avant est le mieux noté (${attendu.nom}, ${attendu.noteMoyenne})`)

  const heures = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map((a) => a.innerText.trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t)))
  dire(heures.length > 0, `des créneaux réels sont affichés (${heures.slice(0, 4).join(' ')}…)`)

  // Un créneau affiché doit mener au tunnel, sinon c'est une décoration.
  const cible = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .find((a) => /^\d{2}:\d{2}$/.test(a.innerText.trim()))?.getAttribute('href'))
  dire(/^\/salon\/\d+\/reserver\?prestationId=\d+$/.test(cible ?? ''),
    `un créneau mène à la réservation (${cible})`)
}

/* ------------------------------------------------------------------ *
 * 3. Les entrées de navigation mènent où elles disent.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Les chemins proposés ───────────────────────────')
const liens = await page.evaluate(() =>
  [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')))
dire(liens.filter((l) => l?.startsWith('/recherche?q=')).length === 5,
  'les cinq métiers filtrent la recherche')
dire(villes.every((v) => liens.includes(`/recherche?ville=${encodeURIComponent(v)}`)),
  'chaque ville filtre la recherche')
dire(liens.includes('/professionnels'), 'l\'entrée professionnelle est proposée')

await page.evaluate(() => [...document.querySelectorAll('a')]
  .find((a) => a.getAttribute('href')?.startsWith('/recherche?q='))?.click())
await pause(1500)
dire(page.url().includes('/recherche?q='),
  `un métier ouvre bien la recherche filtrée (${page.url().replace(BASE, '')}`.concat(')'))

/* ------------------------------------------------------------------ *
 * 4. Tenue sur trois largeurs.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Mise en page ──────────────────────────────────')
for (const [nom, largeur, hauteur] of [['mobile', 390, 844], ['tablette', 768, 1024], ['bureau', 1440, 950]]) {
  const p = await browser.newPage()
  await p.setViewport({ width: largeur, height: hauteur })
  await p.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(1800)
  // Un défilement horizontal sur une page d'accueil est toujours un défaut :
  // il vient d'un élément qui dépasse, jamais d'un choix.
  const trop = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  dire(!trop, `${nom} (${largeur} px) — aucun défilement horizontal`)
  await p.close()
}

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await browser.close()
console.log()
console.log(echecs === 0 ? '✅ Page d\'accueil conforme.' : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
