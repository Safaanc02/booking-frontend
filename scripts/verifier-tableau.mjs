/*
 * Le tableau de bord, vu par chacun des trois rôles.
 *
 * Ce que cette suite garde :
 *
 *   1. La bascule. `/` doit cesser d'être la vitrine dès qu'on est connecté.
 *      C'est la seule chose que l'utilisateur a demandée, et c'est aussi la
 *      plus facile à casser sans le voir — il suffit qu'un chargement change
 *      d'ordre pour que la vitrine reprenne la main une fraction de seconde,
 *      ou définitivement.
 *
 *   2. Que chaque rôle ait un écran à lui, qui ne tombe pas. Un tableau de
 *      bord qui plante rend la page d'accueil inutilisable : ce n'est pas une
 *      page de plus, c'est la porte d'entrée.
 *
 *   3. Que toutes ses sources aient répondu. La page sait dire ce qui lui
 *      manque ; encore faut-il que personne ne s'habitue à ce message.
 *
 * On se connecte pour de bon à travers Keycloak, formulaire compris, plutôt
 * que d'injecter un jeton : c'est le trajet réel, et c'est lui qui révèle
 * qu'une redirection tombe à côté.
 */
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SITE = process.env.SITE_URL ?? 'http://localhost:5173'
const ARGS_SUP = (process.env.CHROME_ARGS ?? '')
  .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((a) => a.replace(/["']/g, '')) ?? []

/*
 * Les comptes de démonstration, et ce que chacun doit trouver.
 *
 * `attendu` est ce qui doit figurer dans le grand encart quel que soit l'état
 * des données : une expression, et non un libellé exact, parce que l'encart
 * change de texte selon qu'il y a ou non quelque chose qui attend. Ce qu'on
 * vérifie, c'est que c'est bien l'encart de ce rôle-là.
 */
const COMPTES = [
  {
    role: 'admin',
    identifiant: process.env.ADMIN_USER ?? 'admin@darzin.ma',
    motDePasse: process.env.ADMIN_PASS ?? 'admin',
    attendu: /à traiter en premier|rien n'attend/i,
    lien: '/admin',
  },
  {
    role: 'gérant',
    identifiant: process.env.PRO_USER ?? 'pro1@darzin.ma',
    motDePasse: process.env.PRO_PASS ?? 'pro1',
    attendu: /prochain rendez-vous|plus rien au programme|aucun salon/i,
    lien: '/pro',
  },
  {
    role: 'cliente',
    identifiant: process.env.CLIENT_USER ?? 'client1@darzin.ma',
    motDePasse: process.env.CLIENT_PASS ?? 'client1',
    attendu: /aujourd'hui|demain|aucun rendez-vous à venir|\d{1,2} \w+/i,
    lien: '/recherche',
  },
]

const ok = (c) => (c ? '✅' : '❌')
let echecs = 0
const dire = (condition, libelle) => {
  if (!condition) echecs += 1
  console.log(' ', ok(condition), libelle)
  return condition
}

const navigateur = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', ...ARGS_SUP],
})

for (const compte of COMPTES) {
  console.log(`\n─── ${compte.role} ${'─'.repeat(Math.max(0, 44 - compte.role.length))}`)

  /* Un contexte par rôle : sans cela le second hérite de la session du
     premier et se voit connecté avant même d'avoir saisi quoi que ce soit. */
  const contexte = await navigateur.createBrowserContext()
  const page = await contexte.newPage()
  await page.setViewport({ width: 1280, height: 1000 })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(e.message))

  await page.goto(SITE, { waitUntil: 'networkidle0' })

  /* Le bouton « Connexion » est désigné par son libellé : sa position dans
     l'en-tête change avec les liens affichés. */
  const entrees = await page.$$('header button, header a')
  const libelles = await page.$$eval('header button, header a',
    (els) => els.map((e) => e.textContent.trim()))
  const rang = libelles.findIndex((t) => /connexion/i.test(t))
  if (!dire(rang >= 0, `l'en-tête porte un bouton Connexion ${rang < 0 ? JSON.stringify(libelles) : ''}`)) {
    await contexte.close()
    continue
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    entrees[rang].click(),
  ])
  await page.type('#username', compte.identifiant)
  await page.type('#password', compte.motDePasse)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#kc-login'),
  ])

  /* Keycloak renvoie vers le site, qui rejoue son initialisation : on attend
     que le tableau de bord ait fini de charger ses sources. */
  await page.waitForFunction(
    () => !document.body.innerText.includes('Votre tableau de bord'),
    { timeout: 20_000 }).catch(() => {})

  const vu = await page.evaluate(() => {
    const texte = document.body.innerText
    return {
      chemin: location.pathname,
      texte,
      /* La vitrine se reconnaît à son accroche. Si elle est là, la bascule
         n'a pas eu lieu. */
      vitrine: texte.includes('Votre prochain rendez-vous'),
      encart: document.querySelector('section.bg-sable')?.innerText ?? '',
      liens: [...document.querySelectorAll('main a')].map((a) => a.getAttribute('href')),
      manquant: /n'(a|ont) pas pu être chargée/.test(texte),
    }
  })

  dire(vu.chemin === '/', `on reste sur / après connexion (${vu.chemin})`)
  dire(!vu.vitrine, 'la vitrine a laissé place au tableau de bord')
  dire(/^(Bonjour|Bonsoir)/m.test(vu.texte), 'la page salue la personne connectée')
  dire(/à Casablanca/.test(vu.texte), "l'heure affichée est celle du salon, pas celle du visiteur")
  dire(compte.attendu.test(vu.encart),
    `le grand encart est celui de ce rôle ${compte.attendu.test(vu.encart) ? '' : JSON.stringify(vu.encart.slice(0, 120))}`)
  dire(vu.liens.includes(compte.lien), `il mène à ${compte.lien}`)
  dire(!vu.manquant, 'toutes ses sources ont répondu')
  dire(erreurs.length === 0, `aucune erreur JS ${erreurs.length ? `: ${erreurs.join(' | ')}` : ''}`)

  await contexte.close()
}

/*
 * Et la vitrine, elle, doit rester intacte pour qui n'est pas connecté : la
 * bascule ne doit pas se déclencher sur une session absente.
 */
console.log(`\n─── visiteur anonyme ${'─'.repeat(28)}`)
const anonyme = await navigateur.newPage()
await anonyme.setViewport({ width: 1280, height: 1000 })
await anonyme.goto(SITE, { waitUntil: 'networkidle0' })
const texteAnonyme = await anonyme.evaluate(() => document.body.innerText)
dire(texteAnonyme.includes('Votre prochain rendez-vous'), 'la vitrine est bien servie')
dire(!/^(Bonjour|Bonsoir)/m.test(texteAnonyme), 'et ne salue personne')

await navigateur.close()
console.log(`\n${echecs === 0 ? '✅ tout est en place' : `❌ ${echecs} échec(s)`}`)
process.exit(echecs === 0 ? 0 : 1)
