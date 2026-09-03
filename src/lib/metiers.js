/*
 * Les cinq familles de prestations.
 *
 * Table unique : les libellés étaient recopiés dans la carte, la fiche, la
 * recherche et l'accueil, et une divergence entre deux copies se voit tout de
 * suite à l'écran sans qu'on sache laquelle corriger.
 *
 * Un salon exerce plusieurs de ces métiers — l'institut de quartier fait la
 * coiffure, l'onglerie et l'esthétique. Le premier de la liste renvoyée par
 * l'API est le métier principal, celui dont le salon porte la couleur.
 */
export const METIERS = {
  COIFFURE: "Coiffure",
  BARBIER: "Barbier",
  ONGLERIE: "Onglerie",
  ESTHETIQUE: "Esthétique",
  SPA: "Hammam & spa",
}

/** Dans l'ordre d'affichage des filtres et des formulaires. */
export const ORDRE_METIERS = ["COIFFURE", "BARBIER", "ONGLERIE", "ESTHETIQUE", "SPA"]

export const libelleMetier = (cle) => METIERS[cle] ?? cle

/**
 * Les métiers d'un salon, principal en tête, quelle que soit la réponse.
 *
 * Tolère l'absence de `metiers` : une réponse plus ancienne, ou un salon créé
 * avant la migration, ne doit pas afficher une liste vide là où sa catégorie
 * est connue.
 */
export const metiersDuSalon = (salon) => {
  const liste = salon?.metiers?.length ? salon.metiers : [salon?.categorie]
  return liste.filter(Boolean)
}
