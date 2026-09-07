/**
 * « Salons autour de moi », dans un vrai navigateur.
 *
 * C'est la première fonction du site qui dépend d'une permission accordée par
 * la personne, et d'un capteur qui peut ne rien rendre. Trois chemins doivent
 * donc tenir, pas un :
 *
 *   • permission accordée : les salons sont classés par distance, et la page
 *     dit depuis quel point et avec quelle précision ;
 *   • permission refusée : une phrase qui explique le geste de réparation, et
 *     la liste des villes toujours utilisable ;
 *   • personne trop loin du réseau : une sortie proposée, pas une page vide.
 *
 * Puppeteer sait mentir sur la position du navigateur, ce qui permet de
 * vérifier le classement depuis Casablanca, depuis Marrakech et depuis un
 * point sans aucun salon à la ronde — trois villes qu'on ne peut pas visiter
 * dans un test manuel.
 *
 *   npm run verifier:proximite
 */
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const API = process.env.API_URL ?? 'http://localhost:8080'
const ARGS_SUP = (process.env.CHROME_ARGS ?? '')
  .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((a) => a.replace(/["']/g, '')) ?? []
const ok = (c) => (c ? '✅' : '❌')

let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))

/** Points de repère, en dur : un test ne doit pas dépendre d'où tourne la machine. */
const CASABLANCA = { latitude: 33.5731, longitude: -7.5898 }
const MARRAKECH = { latitude: 31.6295, longitude: -7.9811 }
/** Plein Atlantique, au large de Safi : aucun salon à moins de 100 km. */
const HAUTE_MER = { latitude: 31.0, longitude: -12.5 }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})

const erreurs = []
const surveiller = (page) => {
  page.on('pageerror', (e) => erreurs.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (!/Failed to load resource|net::ERR_|geolocation/i.test(t)) erreurs.push(t)
  })
  return page
}

/**
 * Ouvre un onglet placé quelque part, avec la permission déjà accordée.
 *
 * overridePermissions évite l'invite du navigateur, qui n'est pas pilotable
 * et bloquerait le test. Elle porte sur l'origine, d'où le BASE.
 */
const ongletSitue = async (position) => {
  const contexte = browser.defaultBrowserContext()
  await contexte.overridePermissions(BASE, ['geolocation'])
  const page = surveiller(await browser.newPage())
  await page.setViewport({ width: 1440, height: 950 })
  await page.setCacheEnabled(false)
  await page.setGeolocation(position)
  return page
}

const cliquerProximite = async (page) => {
  const bouton = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => /autour de moi/i.test(b.innerText)))
  const element = bouton.asElement()
  if (!element) return false
  await element.click()
  return true
}

/* ------------------------------------------------------------------ *
 * 1. L'API, avant l'interface.
 * ------------------------------------------------------------------ */
console.log('─── Le contrat de l\'API ───────────────────────────')
{
  const lire = async (url) => {
    const r = await fetch(url)
    return { statut: r.status, entetes: r.headers, corps: await r.json().catch(() => null) }
  }

  const proche = await lire(`${API}/api/public/salons?lat=33.5731&lng=-7.5898&rayon=25`)
  dire(proche.statut === 200, 'une recherche située répond 200')
  const contenu = proche.corps?.content ?? []
  dire(contenu.length > 0, `des salons remontent autour de Casablanca (${contenu.length})`)
  dire(contenu.every((s) => typeof s.distanceKm === 'number'),
    'chaque salon porte sa distance')
  dire(contenu.every((s) => s.distanceKm <= 25),
    'aucun salon au-delà du rayon demandé')
  const croissantes = contenu.every((s, i) => i === 0 || s.distanceKm >= contenu[i - 1].distanceKm)
  dire(croissantes, 'les distances vont croissant')

  // Le cadre d'index est un carré circonscrit au cercle : ses coins dépassent
  // le rayon de 41 %. Sans filtre exact derrière, un salon à 33 km sortirait
  // d'une recherche à 25 — la promesse du rayon serait fausse.
  const large = await lire(`${API}/api/public/salons?lat=33.5731&lng=-7.5898&rayon=100`)
  const sortis = (large.corps?.content ?? []).filter((s) => s.distanceKm > 100)
  dire(sortis.length === 0, 'les coins du cadre d\'index ne débordent pas du rayon')
  dire((large.corps?.totalElements ?? 0) > (proche.corps?.totalElements ?? 0),
    'élargir le rayon ramène davantage de salons')

  dire(/no-store/.test(proche.entetes.get('cache-control') ?? ''),
    'une position ne part pas dans un cache partagé')
  dire(proche.entetes.get('x-salons-non-situes') !== null,
    'le nombre de salons non situés est annoncé')

  const seule = await fetch(`${API}/api/public/salons?lat=33.57`)
  dire(seule.status === 400, 'une coordonnée seule est refusée')

  const hors = await fetch(`${API}/api/public/salons?lat=91&lng=0`)
  dire(hors.status === 400, 'des coordonnées hors du globe sont refusées')

  // Le rayon est borné côté serveur : sans cela, rayon=20000 rendrait tout le
  // réseau sous un intitulé « autour de vous » qui ne veut plus rien dire.
  const enorme = await lire(`${API}/api/public/salons?lat=33.5731&lng=-7.5898&rayon=99999`)
  dire((enorme.corps?.content ?? []).every((s) => s.distanceKm <= 100),
    'le rayon est plafonné à 100 km')

  // Les autres filtres continuent de s'appliquer : « barbier autour de moi »
  // doit rendre des barbiers.
  const metier = await lire(`${API}/api/public/salons?lat=33.5731&lng=-7.5898&rayon=100&metier=BARBIER`)
  const tous = metier.corps?.content ?? []
  dire(tous.length > 0 && tous.every((s) => (s.metiers ?? []).includes('BARBIER')),
    'le filtre par métier survit à la recherche par distance')

  /*
   * Le repli sur le centre du quartier.
   *
   * Dar Zine n'a jamais eu de coordonnées relevées : il doit se trouver au
   * centre du Guéliz. C'est ce repli qui décide si un salon référencé sans
   * relevé apparaît ou disparaît d'une recherche par proximité — et une
   * disparition ne se remarque pas, ni pour le client ni pour le gérant.
   */
  const guelizLat = 31.6383, guelizLng = -8.0110
  const auGueliz = await lire(`${API}/api/public/salons?lat=${guelizLat}&lng=${guelizLng}&rayon=2`)
  const darZine = (auGueliz.corps?.content ?? []).find((s) => s.nom === 'Dar Zine')
  dire(Boolean(darZine), 'un salon sans relevé est tout de même situé')
  dire(darZine && darZine.distanceKm < 0.2,
    `il est placé au centre de son quartier (${darZine?.distanceKm?.toFixed(2)} km du Guéliz)`)

  const sansPosition = await lire(`${API}/api/public/salons`)
  dire((sansPosition.corps?.content ?? []).every((s) => s.distanceKm == null),
    'hors proximité, aucun salon n\'affiche de distance')
}

/* ------------------------------------------------------------------ *
 * 2. Le bouton, là où on le cherche.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Le bouton sur l\'accueil ───────────────────────')
{
  const page = await ongletSitue(CASABLANCA)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(2000)

  const texte = await page.evaluate(() => document.body.innerText)
  dire(contient(texte, 'autour de moi'), 'le raccourci est proposé sur l\'accueil')

  // Il doit être près de la barre, pas ailleurs dans la page : c'est là qu'on
  // le cherche, et c'est ce qui a été demandé.
  const distanceAuChamp = await page.evaluate(() => {
    const bouton = [...document.querySelectorAll('button')]
      .find((b) => /autour de moi/i.test(b.innerText))
    const champ = document.querySelector('input[placeholder*="oiffeur"]')
    if (!bouton || !champ) return null
    const b = bouton.getBoundingClientRect(), c = champ.getBoundingClientRect()
    return { vertical: b.top - c.bottom, horizontal: Math.abs(b.left - c.left) }
  })
  dire(distanceAuChamp !== null, 'le bouton et le champ de recherche sont trouvés')
  dire(distanceAuChamp && distanceAuChamp.vertical < 60 && distanceAuChamp.vertical > -5,
    `le bouton suit immédiatement la barre (${distanceAuChamp?.vertical?.toFixed(0)} px)`)
  dire(distanceAuChamp && distanceAuChamp.horizontal < 40,
    'il est aligné sur le premier champ')

  const emoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u
  dire(![...texte].some((c) => emoji.test(c)), 'aucun emoji introduit')

  await page.close()
}

/* ------------------------------------------------------------------ *
 * 3. Permission accordée : le classement.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Depuis Casablanca ─────────────────────────────')
{
  const page = await ongletSitue(CASABLANCA)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(1800)
  dire(await cliquerProximite(page), 'le bouton se clique')
  await page.waitForFunction(() => location.search.includes('lat='), { timeout: 20000 })
  await pause(2200)

  const url = new URL(page.url())
  dire(url.pathname === '/recherche', 'on arrive sur la page de résultats')
  dire(url.searchParams.get('rayon') === '25', 'le rayon de départ est de 25 km')

  // La position part arrondie au millième de degré — cent mètres. Ce qui ne
  // quitte pas le navigateur ne peut pas être journalisé.
  const decimales = (v) => (v.split('.')[1] ?? '').length
  dire(decimales(url.searchParams.get('lat')) <= 3 && decimales(url.searchParams.get('lng')) <= 3,
    'la position est arrondie avant de partir')

  const texte = await page.evaluate(() => document.body.innerText)
  dire(contient(texte, 'autour de vous'), 'le titre dit d\'où part le classement')
  dire(contient(texte, 'du plus proche au plus lointain'), 'l\'ordre est annoncé')
  dire(contient(texte, 'vol d’oiseau') || contient(texte, 'vol d\'oiseau'),
    'la nature de la distance est dite')
  dire(contient(texte, 'au quartier près'), 'la précision réelle est dite')

  // Les deux salons de Casablanca, et aucun de Rabat ni de Marrakech.
  dire(contient(texte, 'Nails & Co') || contient(texte, 'Atlas Barber'),
    'les salons casablancais remontent')
  dire(!contient(texte, 'Dar Zine'), 'Marrakech, à 220 km, ne remonte pas')

  const distances = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/salon/"]')].map((c) => {
      const m = c.innerText.match(/(moins de 1|\d+)\s*km/)
      return m ? (m[1] === 'moins de 1' ? 0.5 : Number(m[1])) : null
    }))
  dire(distances.length > 0 && distances.every((d) => d !== null),
    `chaque carte affiche sa distance (${distances.length} cartes)`)
  dire(distances.every((d, i) => i === 0 || d >= distances[i - 1]),
    `les cartes sont dans l'ordre (${distances.join(', ')})`)

  // Rien de plus fin que le kilomètre : le point du salon est un centre de
  // quartier, « à 2,4 km » serait une précision inventée.
  dire(!/\d,\d\s*km/.test(await page.evaluate(() => document.body.innerText)),
    'aucune distance affichée avec une décimale')

  dire(await page.evaluate(() =>
    [...document.querySelectorAll('button, a')].some((e) => /tous les salons/i.test(e.innerText))),
    'une sortie du mode proximité est offerte')

  await page.click('::-p-text(Voir tous les salons)')
  await pause(1800)
  dire(!page.url().includes('lat='), 'la sortie retire la position de l\'adresse')
  const apres = await page.evaluate(() => document.body.innerText)
  dire(contient(apres, 'Dar Zine') || contient(apres, 'Hammam'),
    'tout le réseau revient une fois la position oubliée')

  await page.close()
}

/* ------------------------------------------------------------------ *
 * 4. Depuis une autre ville : le classement suit vraiment le point.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Depuis Marrakech ──────────────────────────────')
{
  const page = await ongletSitue(MARRAKECH)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(1800)
  await cliquerProximite(page)
  await page.waitForFunction(() => location.search.includes('lat='), { timeout: 20000 })
  await pause(2200)

  const texte = await page.evaluate(() => document.body.innerText)
  dire(contient(texte, 'Dar Zine'), 'le salon de Marrakech remonte')
  dire(!contient(texte, 'Atlas Barber'), 'Casablanca ne remonte plus')
  await page.close()
}

/* ------------------------------------------------------------------ *
 * 5. Personne hors du réseau.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Loin de tout salon ────────────────────────────')
{
  const page = await ongletSitue(HAUTE_MER)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(1800)
  await cliquerProximite(page)
  await page.waitForFunction(() => location.search.includes('lat='), { timeout: 20000 })
  await pause(2200)

  const texte = await page.evaluate(() => document.body.innerText)
  dire(contient(texte, 'aucun salon à moins de 25 km'),
    'la page dit qu\'il n\'y a rien à 25 km, et non « rien ne correspond »')
  dire(contient(texte, 'jusqu’à 100 km') || contient(texte, "jusqu'à 100 km"),
    'elle propose d\'élargir')

  await page.click('::-p-text(100 km)')
  await pause(2500)
  const elargi = await page.evaluate(() => document.body.innerText)
  dire(page.url().includes('rayon=100'), 'le rayon passe à 100 km dans l\'adresse')
  dire(!contient(elargi, 'jusqu’à 100 km'),
    'la proposition d\'élargir disparaît au maximum atteint')

  await page.close()
}

/* ------------------------------------------------------------------ *
 * 6. Permission refusée.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Permission refusée ────────────────────────────')
{
  const contexte = browser.defaultBrowserContext()
  await contexte.clearPermissionOverrides()
  const page = surveiller(await browser.newPage())
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await pause(1800)

  // Sans permission accordée et sans interface pour l'invite, Chrome sans tête
  // rejette la demande : c'est exactement le chemin du refus.
  await cliquerProximite(page)
  await pause(3000)

  const texte = await page.evaluate(() => document.body.innerText)
  dire(!page.url().includes('lat='), 'aucune navigation sans position')
  dire(contient(texte, 'refusé') || contient(texte, 'n’a pas pu être déterminée')
       || contient(texte, 'page non sécurisée'),
    'une phrase explique ce qui s\'est passé')
  dire(contient(texte, 'votre ville dans la liste'),
    'elle renvoie vers le choix d\'une ville, qui reste utilisable')
  dire(await page.evaluate(() => Boolean(document.querySelector('select'))),
    'la liste des villes est toujours là')

  await page.close()
}

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await browser.close()
console.log()
console.log(echecs === 0 ? '✅ Recherche par proximité conforme.' : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
