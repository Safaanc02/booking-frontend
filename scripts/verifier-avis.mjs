/**
 * Cycle complet d'un avis, dans un vrai navigateur.
 *
 * Le client note un rendez-vous honoré, l'avis apparaît sur la fiche publique
 * et dans les résultats de recherche, puis le salon y répond.
 *
 * Suppose la stack démarrée et au moins un rendez-vous HONOREE non encore
 * commenté pour le compte de test.
 *
 *   npm run verifier:avis
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
const ok = (c) => (c ? '✅' : '❌')
const COMMENTAIRE = `Très bon accueil, essai ${Date.now().toString().slice(-5)}`

/* ------------------------------------------------------------------ *
 * Préparation par l'API.
 *
 * Chaque exécution consomme un rendez-vous honoré : le script doit donc
 * fabriquer le sien, sans quoi il ne passe qu'une fois. Il réserve un
 * créneau, le fait marquer honoré par le salon, puis pilote l'interface.
 * ------------------------------------------------------------------ */
const API = process.env.API_URL ?? 'http://localhost:8080'
const KC = process.env.KC_URL ?? 'http://localhost:8081'
/** Salon de repli, utilisé seulement s'il faut créer une réservation de zéro. */
const SALON_REPLI = Number(process.env.SALON_ID ?? 1)

const jeton = async (identifiant) => {
  const r = await fetch(`${KC}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', username: identifiant, password: identifiant, grant_type: 'password',
    }),
  })
  if (!r.ok) throw new Error(`authentification ${identifiant} impossible (${r.status})`)
  return (await r.json()).access_token
}

const appel = async (chemin, options = {}, token) => {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const corps = r.status === 204 ? null : await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${options.method ?? 'GET'} ${chemin} → ${r.status} ${JSON.stringify(corps)}`)
  return corps
}

/**
 * Résout le compte propriétaire d'un salon.
 *
 * Chaque salon a le sien : se connecter en pro1 ne donne accès qu'à Atlas
 * Barber. Toute écriture « côté salon » doit donc passer par le bon compte,
 * y compris pendant la préparation — sinon le serveur répond 403, à juste
 * titre.
 *
 * Convention des comptes de démonstration : mot de passe = identifiant.
 */
const proprietaireDuSalon = async (salonId, salonNom, admin) => {
  const liste = await (await fetch(
    `${API}/api/public/salons?q=${encodeURIComponent(salonNom)}&size=50`)).json()
  let ownerId = liste.content?.find((x) => x.id === salonId)?.ownerId

  if (!ownerId) {
    // Salon non publié : on passe par la file d'administration.
    for (const statut of ['EN_ATTENTE', 'ACTIF', 'SUSPENDU']) {
      const page = await appel(`/api/admin/salons?statut=${statut}&size=100`, {}, admin)
      ownerId = page.content?.find((x) => x.id === salonId)?.ownerId
      if (ownerId) break
    }
  }
  if (!ownerId) throw new Error(`propriétaire du salon #${salonId} introuvable`)

  const owner = await appel(`/api/users/${ownerId}`, {}, admin)
  return owner.username
}

const preparerRendezVousHonore = async () => {
  const client = await jeton('client1')
  const admin = await jeton('admin')

  const miennes = await appel('/api/reservations/me', {}, client)
  let cible = miennes.find((r) => r.statut === 'HONOREE' && !r.avisDepose)
            ?? miennes.find((r) => r.statut === 'CONFIRMEE' && !r.avisDepose)

  if (!cible) {
    // Aucune réservation exploitable : on en crée une sur le premier créneau libre.
    const SALON = SALON_REPLI
    const fiche = await (await fetch(`${API}/api/public/salons/${SALON}`)).json()
    const prestation = fiche.prestations?.[0]
    if (!prestation) throw new Error(`le salon ${SALON} n'a aucune prestation`)

    const jours = await (await fetch(
      `${API}/api/public/salons/${SALON}/prochaines-dispos?prestationId=${prestation.id}&jours=14`)).json()
    if (jours.length === 0) throw new Error('aucune disponibilité dans les deux prochaines semaines')

    const dispos = await (await fetch(
      `${API}/api/public/salons/${SALON}/disponibilites?prestationId=${prestation.id}&date=${jours[0]}`)).json()
    const creneau = dispos.creneaux?.[dispos.creneaux.length - 1]
    if (!creneau) throw new Error('aucun créneau libre')

    cible = await appel('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({ salonId: SALON, prestationId: prestation.id, debut: creneau.debut }),
    }, client)
  }

  // Le propriétaire est résolu AVANT toute écriture côté salon.
  const proprietaire = await proprietaireDuSalon(cible.salonId, cible.salonNom, admin)

  if (cible.statut !== 'HONOREE') {
    const tokenPro = await jeton(proprietaire)
    await appel(`/api/pro/reservations/${cible.id}/statut?statut=HONOREE`, { method: 'PATCH' }, tokenPro)
  }

  return { id: cible.id, salonId: cible.salonId, salonNom: cible.salonNom, proprietaire }
}

const rdv = await preparerRendezVousHonore()
const SALON = rdv.salonId
console.log(`─── Préparation ────────────────────────────────────`)
console.log(`   rendez-vous #${rdv.id} chez ${rdv.salonNom} (salon #${SALON}), honoré et sans avis`)
console.log(`   propriétaire du salon : ${rdv.proprietaire}`)
console.log()

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
// Les routes publiques renvoient Cache-Control: max-age=60. C'est voulu en
// production, mais dans un test qui écrit puis relit dans la même minute, le
// navigateur servirait la version d'avant et ferait échouer une assertion
// pourtant correcte.
await page.setCacheEnabled(false)
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

const txtDe = (p) => p.evaluate(() => document.body.innerText)
const txt = () => txtDe(page)
const contient = (s, a) => s.toLocaleLowerCase('fr').includes(a.toLocaleLowerCase('fr'))
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const attendreSur = async (p, attendu, timeout = 15000) => {
  const limite = Date.now() + timeout
  while (Date.now() < limite) {
    if (contient(await txtDe(p), attendu)) return true
    await pause(150)
  }
  return false
}
const attendre = (attendu, timeout) => attendreSur(page, attendu, timeout)

const clicSur = async (p, filtre, timeout = 15000) => {
  const limite = Date.now() + timeout
  let fait = false
  while (Date.now() < limite && !fait) {
    fait = await p.evaluate((f) => {
      const els = [...document.querySelectorAll('button, a, label')]
      const el = els.find((e) => e.innerText.trim() === f) ?? els.find((e) => e.innerText.includes(f))
      if (!el || el.disabled) return false
      el.click()
      return true
    }, filtre)
    if (!fait) await pause(150)
  }
  if (!fait) throw new Error(`introuvable ou désactivé : ${filtre}`)
  await pause(400)
}
const clic = (filtre, timeout) => clicSur(page, filtre, timeout)

const connecterSur = async (p, identifiant, motDePasse) => {
  await clicSur(p, 'Se connecter')
  await p.waitForSelector('#username', { timeout: 25000 })
  await p.type('#username', identifiant)
  await p.type('#password', motDePasse)
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
    p.click('#kc-login'),
  ])
  await pause(2000)
}
const connecter = (i, m) => connecterSur(page, i, m)

console.log('─── Le client note un rendez-vous honoré ───────────')
await page.goto(`${BASE}/compte`, { waitUntil: 'networkidle0' })
await attendre('Connectez-vous')
await connecter('client1', 'client1')
console.log(' ', ok(await attendre('Mes réservations')), 'compte accessible')
console.log(' ', ok(await attendre('Donner mon avis')),
  'le dépôt n\'est proposé que sur un rendez-vous honoré')

await clic('Donner mon avis')
await attendre('Votre note')
// Les étoiles sont de vrais boutons radio : on coche le quatrième.
const noteMise = await page.evaluate(() => {
  const radios = [...document.querySelectorAll('input[type=radio][value="4"]')]
  if (radios.length === 0) return false
  radios[0].click()
  return true
})
console.log(' ', ok(noteMise), 'note de 4 sur 5 sélectionnée au clavier comme à la souris')

await page.evaluate((c) => {
  const ta = document.querySelector('textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, c)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}, COMMENTAIRE)
await clic('Publier')
console.log(' ', ok(await attendre('votre avis a bien été enregistré')),
  'avis enregistré, le formulaire ne réapparaît plus')

console.log('\n─── L\'avis apparaît côté public ────────────────────')
await page.goto(`${BASE}/salon/${SALON}`, { waitUntil: 'networkidle0' })
console.log(' ', ok(await attendre('Avis clients')), 'section présente sur la fiche')
console.log(' ', ok(await attendre(COMMENTAIRE)), 'le commentaire est visible')
const note = await page.evaluate(() => {
  const m = document.body.innerText.match(/★\s*([\d,]+)\s*·\s*(\d+) avis/)
  return m ? { moyenne: m[1], nombre: m[2] } : null
})
console.log(' ', ok(note !== null), note ? `note affichée : ${note.moyenne} sur ${note.nombre} avis` : 'note absente ❌')

// On cherche par le nom du salon : sa ville dépend du jeu de données.
await page.goto(`${BASE}/recherche?q=${encodeURIComponent(rdv.salonNom)}`, { waitUntil: 'networkidle0' })
await attendre('salon')
const noteListe = await page.evaluate(() => /★\s*[\d,]+\s*·\s*\d+ avis/.test(document.body.innerText))
console.log(' ', ok(noteListe), 'note visible dès la liste de résultats')

console.log('\n─── Le salon répond ────────────────────────────────')
// Contexte de navigation isolé plutôt qu'une déconnexion : la redirection de
// logout Keycloak et la navigation suivante se télescopaient, et le test
// atterrissait sur une page imprévue.
const contextePro = await browser.createBrowserContext()
const pagePro = await contextePro.newPage()
await pagePro.setViewport({ width: 1280, height: 1000 })
await pagePro.setCacheEnabled(false)
brancher(pagePro)

await pagePro.goto(`${BASE}/pro`, { waitUntil: 'networkidle0' })
await attendreSur(pagePro, 'Espace professionnel')
await connecterSur(pagePro, rdv.proprietaire, rdv.proprietaire)
console.log(' ', ok(await attendreSur(pagePro, 'Mes salons')), 'tableau de bord professionnel')

await clicSur(pagePro, rdv.salonNom)
await attendreSur(pagePro, 'Agenda')
await clicSur(pagePro, 'Avis')
console.log(' ', ok(await attendreSur(pagePro, 'Avis clients')), 'onglet Avis accessible')
console.log(' ', ok(await attendreSur(pagePro, COMMENTAIRE)), 'l\'avis du client y figure')

const REPONSE = 'Merci pour votre retour, à très bientôt !'
const saisie = await pagePro.evaluate((r) => {
  const ta = [...document.querySelectorAll('textarea')].find((t) => t.placeholder.includes('Répondre'))
  if (!ta) return false
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, r)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, REPONSE)
console.log(' ', ok(saisie), 'zone de réponse disponible')
await clicSur(pagePro, 'Publier ma réponse')
console.log(' ', ok(await attendreSur(pagePro, 'Votre réponse')), 'réponse enregistrée')

await page.goto(`${BASE}/salon/${SALON}`, { waitUntil: 'networkidle0' })
console.log(' ', ok(await attendre('Réponse du salon')), 'la réponse est publique')
console.log(' ', ok(await attendre(REPONSE)), 'son texte est bien celui saisi')
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/avis.png', fullPage: true })

console.log('\n─── Bilan ──────────────────────────────────────────')
console.log(' ', ok(erreurs.length === 0),
  erreurs.length === 0 ? 'aucune erreur JavaScript' : `erreurs JS : ${erreurs.slice(0, 3).join(' | ')}`)
if (reseau.length > 0) {
  console.log(`   ${reseau.length} réponse(s) HTTP en erreur, gérées par l'interface :`)
  for (const r of [...new Set(reseau)].slice(0, 3)) console.log(`     ${r}`)
}

await browser.close()
process.exit(erreurs.length === 0 ? 0 : 1)
