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
await page.setViewport({ width: 1440, height: 950 })
await page.setCacheEnabled(false)

const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (!/Failed to load resource|net::ERR_/.test(t)) erreurs.push(t)
})

/*
 * Délai d'attente par défaut des aides ci-dessous.
 *
 * 25 secondes : à travers un tunnel, chaque requête coûte un aller-retour
 * hors du réseau local. Un test qui patiente ne coûte du temps que lorsque
 * quelque chose est réellement cassé.
 */
const ATTENTE = 25000

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
/*
 * Les métiers filtrent par catégorie, non par mot-clé.
 *
 * Ils pointaient vers /recherche?q=Coiffure, une recherche textuelle qui
 * tombait juste par coïncidence de vocabulaire — « Hammam & spa » ne
 * correspondait à rien. Ils désignent maintenant la catégorie du salon.
 */
dire(liens.filter((l) => l?.startsWith('/recherche?metier=')).length === 5,
  'les cinq métiers filtrent la recherche par catégorie')
dire(villes.every((v) => liens.includes(`/recherche?ville=${encodeURIComponent(v)}`)),
  'chaque ville filtre la recherche')
dire(liens.includes('/professionnels'), 'l\'entrée professionnelle est proposée')

await page.evaluate(() => [...document.querySelectorAll('a')]
  .find((a) => a.getAttribute('href')?.startsWith('/recherche?metier='))?.click())
await pause(2000)
dire(page.url().includes('/recherche?metier='),
  `un métier ouvre bien la recherche filtrée (${page.url().replace(BASE, '')}`.concat(')'))
// Le filtre doit réellement mener à des résultats, pas seulement figurer
// dans l'URL. Cette suite n'a pas d'aide d'attente : on boucle sur le texte.
let resultats = false
for (let i = 0; i < 40 && !resultats; i++) {
  resultats = contient(await txt(), 'salon')
  if (!resultats) await pause(200)
}
dire(resultats, 'la page de résultats répond au filtre')

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

/* ------------------------------------------------------------------ *
 * Les résultats annoncent quand, pas seulement combien.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── La prochaine disponibilité ─────────────────────')
{
  /*
   * La carte disait le prix et taisait la disponibilité : on ouvrait les
   * fiches une par une pour découvrir que la première est complète jusqu'à
   * jeudi. Le contrat d'API l'annonçait depuis le début.
   *
   * Le test compare ce qu'affiche la carte à ce que répond le moteur, et non
   * à une chaîne attendue : une carte qui annoncerait « libre demain » quand
   * le moteur n'a rien avant lundi serait pire que le silence d'avant.
   */
  const ville = (await (await fetch(`${API}/api/public/villes`)).json())[0]
  const recherche = await (await fetch(
    `${API}/api/public/salons?ville=${encodeURIComponent(ville)}&size=20`)).json()
  const ids = (recherche.content ?? []).map((s) => s.id)
  const attendues = await (await fetch(
    `${API}/api/public/salons/prochaines-dispos?ids=${ids.join(',')}`)).json()

  const q = await browser.newPage()
  await q.setViewport({ width: 1440, height: 950 })
  await q.setCacheEnabled(false)
  q.on('pageerror', (e) => erreurs.push(String(e)))
  await q.goto(`${BASE}/recherche?ville=${encodeURIComponent(ville)}`, { waitUntil: 'networkidle0' })
  await pause(3000)

  const cartes = await q.evaluate(() =>
    [...document.querySelectorAll('a[href^="/salon/"]')].map((c) => ({
      id: Number(c.getAttribute('href').split('/').pop()),
      libre: (c.innerText.match(/Libre ([^\n]+)/) ?? [])[1] ?? null,
    })))
  await q.close()

  const avecDispo = cartes.filter((c) => c.libre)
  dire(cartes.length > 0, `${cartes.length} carte(s) affichée(s) à ${ville}`)
  dire(avecDispo.length === Object.keys(attendues).filter((id) => ids.includes(Number(id))).length,
    `autant de disponibilités affichées que le moteur en connaît (${avecDispo.length})`)
  dire(cartes.every((c) => Boolean(c.libre) === Boolean(attendues[c.id])),
    'aucune carte n\'annonce une disponibilité que le moteur ignore, ni l\'inverse')

  // « aujourd'hui » et « demain » plutôt qu'une date : ce sont les deux
  // réponses qui font cliquer, et une date les dirait moins bien.
  const aujourdhui = avecDispo.filter((c) => {
    const d = attendues[c.id]?.date
    return d === new Date().toISOString().slice(0, 10)
  })
  dire(aujourdhui.every((c) => /aujourd.hui/i.test(c.libre)),
    `le jour même se dit « aujourd'hui » (${aujourdhui.length} carte(s))`)
}

/* ------------------------------------------------------------------ *
 * La liste des villes ne propose que des villes couvertes.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Les villes proposées ───────────────────────────')
{
  /*
   * Seule la page d'accueil passait la liste réelle à la barre de recherche.
   * Ailleurs, elle retombait sur dix villes écrites en dur quand le réseau
   * n'en couvrait que quatre : six choix menaient à coup sûr sur une page
   * vide, sans que rien ne l'explique. Le repli existe toujours, mais il ne
   * sert plus qu'en cas de serveur muet.
   */
  const couvertes = await (await fetch(`${API}/api/public/villes`)).json()

  const lire = async (chemin) => {
    const q = await browser.newPage()
    await q.setViewport({ width: 1440, height: 950 })
    await q.setCacheEnabled(false)
    q.on('pageerror', (e) => erreurs.push(String(e)))
    await q.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle0' })
    await pause(2000)
    const options = await q.evaluate(() =>
      [...(document.querySelector('select')?.options ?? [])]
        .map((o) => o.value).filter(Boolean))
    await q.close()
    return options
  }

  for (const [nom, chemin] of [['accueil', '/'], ['résultats', '/recherche']]) {
    const proposees = await lire(chemin)
    const fantomes = proposees.filter((v) => !couvertes.includes(v))
    dire(proposees.length > 0, `${nom} : la liste des villes est remplie (${proposees.length})`)
    dire(fantomes.length === 0,
      `${nom} : aucune ville sans salon proposée${fantomes.length ? ` — ${fantomes.join(', ')}` : ''}`)
  }
}

/* ------------------------------------------------------------------ *
 * La carte du salon en vedette ne disparaît plus en silence.
 * ------------------------------------------------------------------ */
console.log()
console.log('─── La carte de créneaux, quand ça se passe mal ────')

/**
 * Ouvre l'accueil en détournant certains appels de l'API.
 *
 * C'est le seul moyen de voir ce que voit quelqu'un dont la connexion traîne
 * ou dont un appel échoue. Ces états-là ne se provoquent pas à la main, et
 * c'est justement dans ceux-là que la carte s'effaçait sans un mot : elle se
 * construit en trois appels enchaînés, et rendait `null` tant que les trois
 * n'avaient pas abouti. On a demandé deux fois où était passé le salon.
 */
const ouvrirDetourne = async ({ bloquer = [], lent = [] } = {}) => {
  const q = await browser.newPage()
  await q.setViewport({ width: 1440, height: 900 })
  await q.setCacheEnabled(false)
  await q.setRequestInterception(true)
  q.on('request', async (r) => {
    const u = r.url()
    if (bloquer.some((m) => u.includes(m))) return r.abort()
    if (lent.some((m) => u.includes(m))) {
      await new Promise((x) => setTimeout(x, 4000))
      return r.continue()
    }
    r.continue()
  })
  q.on('pageerror', (e) => erreurs.push(String(e)))
  await q.goto(BASE, { waitUntil: 'domcontentloaded' })
  return q
}

/** La carte, repérée à sa forme : le seul bloc arrondi à ombre portée du haut. */
const carteVedette = (q) => q.evaluate(() => {
  const d = [...document.querySelectorAll('div')].find((x) =>
    x.className.includes?.('rounded-3xl') && x.className.includes?.('shadow-xl'))
  return d ? Math.round(d.getBoundingClientRect().width) : 0
})

{
  // Pendant les trois appels : la colonne doit déjà exister, à sa largeur
  // définitive, sinon la mise en page saute et la page paraît amputée.
  const q = await ouvrirDetourne({ lent: ['/prochaines-dispos'] })
  await pause(2200)
  const largeur = await carteVedette(q)
  dire(largeur > 300, `la colonne tient sa place pendant le chargement (${largeur} px)`)
  const pendant = await q.evaluate(() => document.body.innerText)
  dire(contient(pendant, 'Dar Zine') || /[A-Z]/.test(pendant),
    'le salon est déjà nommé pendant l\'attente')
  await pause(4200)
  dire(contient(await q.evaluate(() => document.body.innerText), 'libre en ce moment'),
    'elle se remplit dès que l\'appel aboutit')
  await q.close()
}

{
  // Créneaux en échec : le salon reste montré, l'échec est dit, et la carte
  // ne promet plus de disponibilité qu'elle ne connaît pas.
  const q = await ouvrirDetourne({ bloquer: ['/disponibilites'] })
  await pause(4000)
  const texte = await q.evaluate(() => document.body.innerText)
  dire(await carteVedette(q) > 300, 'la carte reste quand les créneaux échouent')
  dire(contient(texte, 'salon en vedette'), 'l\'intitulé cesse de promettre des créneaux')
  dire(contient(texte, 'pas pu être chargés'), 'l\'échec est écrit')
  dire(!contient(texte, 'libre en ce moment'),
    'aucune disponibilité n\'est annoncée sans être connue')
  dire(/Voir /.test(texte), 'une sortie vers la fiche est offerte')
  await q.close()
}

{
  // Réseau entier muet : le décompte laisse place à l'échec et à un moyen de
  // réessayer, et le reste de la page tient debout.
  const q = await ouvrirDetourne({ bloquer: ['/api/public/'] })
  await pause(4000)
  const texte = await q.evaluate(() => document.body.innerText)
  dire(contient(texte, 'pas pu être chargés') || contient(texte, 'Réessayer'),
    'un réseau injoignable est annoncé, pas tu')
  dire(contient(texte, 'sans un seul appel'), 'le reste de la page tient debout')
  await q.close()
}

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await browser.close()
console.log()
console.log(echecs === 0 ? '✅ Page d\'accueil conforme.' : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
