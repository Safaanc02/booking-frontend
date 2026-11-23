import { favorisApi } from "../api/bookingApi"

/*
 * Les favoris, partagés entre tous les cœurs de la page.
 *
 * Un cœur sur une carte de résultat, un autre sur la fiche, la liste « Mes
 * salons » sur le tableau de bord : tous lisent le même ensemble, et un clic
 * sur l'un met les autres à jour sans recharger. Un petit magasin suffit —
 * un Set, une liste d'abonnés, un seul chargement.
 *
 * Optimiste : le cœur se remplit au clic, et se vide si le serveur refuse.
 * Une cliente qui attend un aller-retour pour voir son geste pris en compte
 * clique deux fois.
 */
let ids = new Set()
let charge = false
let promesse = null
const abonnes = new Set()

const prevenir = () => abonnes.forEach((f) => f(new Set(ids)))

export const chargerFavoris = () => {
  if (promesse) return promesse
  promesse = favorisApi.mesSalons()
    .then((liste) => { ids = new Set(liste); charge = true; prevenir() })
    .catch(() => { promesse = null })
  return promesse
}

export const abonner = (f) => {
  abonnes.add(f)
  f(new Set(ids))
  if (!charge) chargerFavoris()
  return () => abonnes.delete(f)
}

export const basculerFavori = (salonId) => {
  const etait = ids.has(salonId)
  if (etait) ids.delete(salonId); else ids.add(salonId)
  prevenir()
  const appel = etait ? favorisApi.retirer(salonId) : favorisApi.garder(salonId)
  return appel.catch(() => {
    if (etait) ids.add(salonId); else ids.delete(salonId)
    prevenir()
  })
}

/** À la déconnexion : les favoris de quelqu'un d'autre ne doivent pas rester affichés. */
export const oublierFavoris = () => { ids = new Set(); charge = false; promesse = null; prevenir() }
