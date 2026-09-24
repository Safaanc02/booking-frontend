/*
 * Le ménage des suites de vérification.
 *
 * Deux suites référencent un salon pour éprouver le parcours complet. Elles
 * le créaient sous un nom suffixé de l'horodatage — « Studio Yasmine 558038 »
 * — pour pouvoir tourner deux fois sans buter sur un nom déjà pris.
 *
 * Le contournement a fini par coûter plus cher que le problème : au bout de
 * quelques dizaines d'exécutions, le catalogue public comptait quatre-vingt-
 * treize salons de test pour six réels. La page de recherche annonçait
 * « 62 salons », le tableau de bord « 34 en attente de validation » — des
 * chiffres avec lesquels on ne pilote rien, et un catalogue que personne ne
 * peut montrer.
 *
 * Une suite doit rendre la base telle qu'elle l'a trouvée. Le ménage passe
 * donc avant — pour qu'une exécution interrompue ne bloque pas la suivante —
 * et après. Les noms redeviennent fixes, et lisibles.
 *
 * Ce qu'il sait faire, et ses limites :
 *
 *   • un salon sans réservation se supprime ; avec des réservations, le
 *     serveur refuse, et c'est justement ce qu'on attend de lui — effacer un
 *     salon effacerait l'historique de ses clients. Le ménage le signale et
 *     passe au suivant plutôt que d'échouer.
 *
 *   • un compte se supprime des deux côtés. Le miroir local ne suffit pas :
 *     l'adresse resterait prise dans Keycloak, et la création suivante
 *     échouerait sur « e-mail déjà utilisé ».
 *
 * Rien de tout cela ne doit faire échouer une suite : le ménage est au
 * service de la vérification, pas l'inverse.
 */

const STATUTS = ['EN_ATTENTE', 'ACTIF', 'SUSPENDU']

async function jetonApplication(kc, identifiant, motDePasse) {
  const r = await fetch(`${kc}/realms/booking-realm/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'booking-app', grant_type: 'password',
      username: identifiant, password: motDePasse,
    }),
  })
  if (!r.ok) return null
  return (await r.json()).access_token
}

async function jetonKeycloak(kc, identifiant, motDePasse) {
  const r = await fetch(`${kc}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'admin-cli', grant_type: 'password',
      username: identifiant, password: motDePasse,
    }),
  })
  if (!r.ok) return null
  return (await r.json()).access_token
}

/** Les salons portant exactement l'un de ces noms, tous statuts confondus. */
async function trouverSalons(api, jeton, noms) {
  const trouves = []
  for (const statut of STATUTS) {
    const r = await fetch(`${api}/api/admin/salons?statut=${statut}&page=0&size=200`,
      { headers: { Authorization: `Bearer ${jeton}` } })
    if (!r.ok) continue
    const page = await r.json()
    for (const s of page.content ?? []) {
      if (noms.includes(s.nom)) trouves.push(s)
    }
  }
  return trouves
}

/**
 * Les rendez-vous d'un salon de test, pour qu'il puisse ensuite disparaître.
 *
 * L'API n'expose pas « tous les rendez-vous d'un salon » à l'administration :
 * on passe par l'agenda, sur une fenêtre large de part et d'autre du jour, ce
 * qui couvre largement ce qu'une suite peut créer.
 */
async function effacerRendezVous(api, jeton, salonId, dit) {
  const depart = new Date()
  depart.setDate(depart.getDate() - 120)
  const jour = depart.toISOString().slice(0, 10)

  const r = await fetch(`${api}/api/pro/salons/${salonId}/agenda?date=${jour}&jours=400`,
    { headers: { Authorization: `Bearer ${jeton}` } })
  if (!r.ok) return

  const rendezVous = await r.json().catch(() => [])
  let effaces = 0
  for (const rv of rendezVous) {
    const d = await fetch(`${api}/api/reservations/${rv.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` } })
    if (d.ok || d.status === 204) effaces += 1
  }
  if (effaces > 0) dit(`${effaces} rendez-vous de test effacé(s)`)
}

/**
 * Efface les salons et les comptes que les suites créent.
 *
 * `bavard` pour un appel de fin, où l'on veut voir ce qui a été rendu ;
 * silencieux avant la suite, où ce ménage n'est qu'une précaution.
 */
export async function nettoyer({ api, kc, salons = [], emails = [], bavard = false }) {
  const dit = (t) => { if (bavard) console.log('  ', t) }

  const admin = process.env.ADMIN_USER ?? 'admin'
  const motDePasse = process.env.ADMIN_PASS ?? 'admin'
  const jeton = await jetonApplication(kc, admin, motDePasse)
  if (!jeton) { dit('ménage impossible : connexion administrateur refusée'); return }

  /* ---- Les salons ---- */
  for (const salon of await trouverSalons(api, jeton, salons)) {
    /* Les rendez-vous d'abord, sinon le serveur refuse — et il a raison :
       effacer un salon effacerait l'historique de ses clientes.
       Ici les salons sont nommés explicitement par la suite appelante, donc
       créés par elle : leurs rendez-vous sont des rendez-vous de test, et les
       laisser derrière soi fait revenir le problème qu'on vient de régler,
       un salon fantôme à la fois. */
    await effacerRendezVous(api, jeton, salon.id, dit)

    const r = await fetch(`${api}/api/salons/${salon.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` } })
    if (r.status === 204) dit(`salon « ${salon.nom} » effacé`)
    else if (r.status === 409) dit(`salon « ${salon.nom} » gardé : il a des rendez-vous`)
    else dit(`salon « ${salon.nom} » non effacé (HTTP ${r.status})`)
  }

  /* ---- Les comptes, dans Keycloak puis dans le miroir local ---- */
  if (emails.length === 0) return
  const maitre = await jetonKeycloak(
    kc, process.env.KEYCLOAK_ADMIN ?? 'admin', process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin')
  if (!maitre) { dit('comptes gardés : console Keycloak inaccessible'); return }

  for (const email of emails) {
    /* Une entrée terminée par « * » vaut préfixe. La suite du formulaire de
       démonstration ne peut pas prendre d'adresse fixe : le serveur refuse
       qu'une même adresse redépose dans les vingt-quatre heures, et ce garde
       anti-robot vaut mieux que la commodité d'un test. */
    const motif = email.endsWith('*')
    const requete = motif
      ? `email=${encodeURIComponent(email.slice(0, -1))}`
      : `email=${encodeURIComponent(email)}&exact=true`
    const r = await fetch(`${kc}/admin/realms/booking-realm/users?${requete}&max=200`,
      { headers: { Authorization: `Bearer ${maitre}` } })
    if (!r.ok) continue
    const trouves = (await r.json())
      .filter((u) => !motif || (u.email ?? '').startsWith(email.slice(0, -1)))
    for (const u of trouves) {
      const d = await fetch(`${kc}/admin/realms/booking-realm/users/${u.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${maitre}` } })
      dit(d.ok ? `compte « ${u.email} » effacé` : `compte « ${u.email} » non effacé (HTTP ${d.status})`)
    }
  }
}
