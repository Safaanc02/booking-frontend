/**
 * Inscription d'un client, du formulaire à ses réservations.
 *
 * Ce parcours n'était pas vérifié, et c'est par là qu'un défaut est passé :
 * l'inscription était ouverte, le compte se créait, la connexion réussissait,
 * le bandeau affichait le nom — et chaque route authentifiée refusait le
 * jeton. Le realm ne plaçait aucun rôle métier par défaut, seulement les
 * rôles de gestion de compte propres à Keycloak. « Accès refusé » sur sa
 * propre page de réservations, avec un bouton « Réessayer » qui ne pouvait
 * rien y changer.
 *
 * Un compte neuf est donc créé à chaque exécution, par le vrai formulaire, et
 * la suite exige qu'il puisse lire ses réservations. C'est le seul test qui
 * traverse Keycloak et l'API avec un jeton obtenu comme un client l'obtient.
 *
 *   npm run verifier:inscription
 */
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'
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

const SUFFIXE = Date.now().toString().slice(-8)
const EMAIL = `cliente.${SUFFIXE}@example.ma`
const MOT_DE_PASSE = `Essai-${SUFFIXE}!`
const PRENOM = 'Hind'
const NOM = 'Zerouali'

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

const txt = () => page.evaluate(() => document.body.innerText)

/** Remplit un champ repéré par son identifiant, s'il existe. */
const saisir = async (selecteur, valeur) => {
  if (!(await page.$(selecteur))) return false
  await page.type(selecteur, valeur)
  return true
}

/* ------------------------------------------------------------------ *
 * 1. Le formulaire d'inscription
 * ------------------------------------------------------------------ */
console.log('─── S’inscrire ────────────────────────────────────')
await page.goto(BASE, { waitUntil: 'networkidle0' })
await pause(1500)

const lienInscription = await page.evaluateHandle(() =>
  [...document.querySelectorAll('a, button')].find((e) => /inscription/i.test(e.innerText)))
const bouton = lienInscription.asElement()
dire(Boolean(bouton), 'l’accueil propose de s’inscrire')
await bouton.click()
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {})
await pause(2000)

dire(/\/realms\/booking-realm\//.test(page.url()),
  'on arrive sur la page d’inscription de Keycloak')

// Keycloak 26 exige prénom et nom : un compte créé sans eux se voit refuser
// tout jeton avec « Account is not fully set up », sans rien qui l'indique.
const champs = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map((i) => i.id || i.name).filter(Boolean))
dire(champs.some((c) => /firstName/i.test(c)) && champs.some((c) => /lastName/i.test(c)),
  'le formulaire demande prénom et nom, comme Keycloak l’exige')

await saisir('#email', EMAIL)
await saisir('#firstName', PRENOM)
await saisir('#lastName', NOM)
await saisir('#password', MOT_DE_PASSE)
await saisir('#password-confirm', MOT_DE_PASSE)
// L'identifiant est un champ à part quand l'e-mail ne sert pas d'identifiant.
await saisir('#username', EMAIL)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('input[type=submit], button[type=submit]')][0]
  if (b) b.click()
})
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
await pause(2500)

dire(page.url().startsWith(BASE), 'l’inscription ramène sur le site')
const apresInscription = await txt()
dire(contient(apresInscription, PRENOM) || contient(apresInscription, NOM)
     || contient(apresInscription, 'déconnexion'),
  'le bandeau montre que la session est ouverte')

/* ------------------------------------------------------------------ *
 * 2. Ses réservations — le mur sur lequel on butait
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Sa page de réservations ───────────────────────')
await page.goto(`${BASE}/compte`, { waitUntil: 'networkidle0' })
await pause(2500)

const compte = await txt()
dire(contient(compte, 'mes réservations'), 'la page s’affiche')
dire(!contient(compte, 'accès refusé'),
  'l’API ne refuse pas le compte qu’elle vient de laisser créer')
dire(contient(compte, 'aucune réservation'),
  'un compte neuf voit un agenda vide, et non une erreur')
dire(contient(compte, EMAIL), 'son adresse est rappelée')
dire(!contient(compte, 'Réessayer'),
  'aucun bouton « Réessayer » sur un problème qu’un nouvel essai ne règle pas')

/* ------------------------------------------------------------------ *
 * 3. Le rôle voyage-t-il vraiment dans le jeton ?
 * ------------------------------------------------------------------ */
console.log()
console.log('─── Le jeton et le rôle ───────────────────────────')
{
  /*
   * Le jeton est demandé à Keycloak, non lu dans le navigateur.
   *
   * keycloak-js le garde en mémoire et non dans sessionStorage : c'est le bon
   * choix — un jeton dans le stockage survit à l'onglet et se lit depuis
   * n'importe quel script de la page. Il n'est donc pas récupérable de
   * l'extérieur, et la suite l'obtient comme le ferait n'importe quel client
   * du realm, par les identifiants qu'elle vient de créer.
   *
   * Vérifier la page ne suffisait pas : un rôle attribué en base mais absent
   * du jeton donnerait le même « Accès refusé », et un rôle présent dans le
   * jeton que l'API n'accepterait pas donnerait encore le même écran. Trois
   * questions distinctes, trois réponses.
   */
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', grant_type: 'password',
      username: EMAIL, password: MOT_DE_PASSE, scope: 'openid',
    }),
  })
  const obtenu = dire(r.ok, `un jeton s’obtient avec ces identifiants (HTTP ${r.status})`)

  if (obtenu) {
    const jeton = (await r.json()).access_token
    const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString())
    const roles = charge.realm_access?.roles ?? []
    const metier = roles.filter((x) => ['client', 'pro', 'admin'].includes(x))
    dire(roles.includes('client'),
      `le jeton porte « client » (rôles métier : ${metier.join(', ') || 'AUCUN'})`)

    const mes = await fetch(`${API}/api/reservations/me`, {
      headers: { Authorization: `Bearer ${jeton}` },
    })
    dire(mes.status === 200, `l’API sert ses réservations (HTTP ${mes.status})`)
    if (mes.status === 200) {
      const corps = await mes.json()
      dire(Array.isArray(corps?.content ?? corps),
        'la réponse est une liste, vide pour un compte neuf')
    }
  }
}

console.log()
console.log('─── Journal du navigateur ──────────────────────────')
dire(erreurs.length === 0, `aucune exception JavaScript${erreurs.length ? ` (${erreurs.length})` : ''}`)
erreurs.slice(0, 5).forEach((e) => console.log('     ', e.slice(0, 160)))

await browser.close()
console.log()
console.log(echecs === 0
  ? `✅ Inscription cliente conforme (${EMAIL}).`
  : `❌ ${echecs} assertion(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
