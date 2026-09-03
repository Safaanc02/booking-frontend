/*
 * Identité visuelle d'un salon, calculée depuis son nom.
 *
 * Le produit n'accepte pas encore de photos, et un cadre gris à leur place
 * donne l'air d'un site en travaux — c'est précisément ce qui rendait les
 * résultats de recherche si ternes. À défaut d'image, on en fabrique une.
 *
 * Le tirage est déterministe : un salon garde son bandeau d'une visite à
 * l'autre et d'un écran à l'autre, si bien que la liste de résultats et la
 * fiche s'accordent et qu'on reconnaît l'établissement avant d'en lire le
 * nom. Un tirage aléatoire aurait produit l'inverse — du désordre à chaque
 * rechargement.
 *
 * Ces valeurs vivent hors des composants : le rechargement à chaud de Vite
 * exige qu'un fichier de composants n'exporte que des composants, et la règle
 * du projet le vérifie.
 */

/**
 * Empreinte stable d'une chaîne.
 *
 * FNV-1a : quatre lignes, bien répartie, et surtout identique partout. Une
 * somme de codes de caractères aurait donné la même valeur à « Dar Zine » et
 * « Zine Dar », donc le même bandeau à deux salons voisins.
 */
const empreinte = (texte) => {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return Math.abs(h)
}

/**
 * Palettes par métier.
 *
 * La teinte dit l'activité avant que l'œil n'atteigne le libellé : bordeaux
 * pour la coiffure, encre pour le barbier, rose pour l'onglerie, jade pour
 * l'esthétique, cuivre pour le hammam. Deux variantes par métier évitent que
 * deux salons de la même liste se ressemblent.
 */
const PALETTES = {
  COIFFURE: [["#8b3244", "#c2566a"], ["#6f2837", "#a83f54"]],
  BARBIER: [["#1c1917", "#44403c"], ["#292524", "#57534e"]],
  ONGLERIE: [["#9d3f5e", "#d98693"], ["#7d2d4a", "#c2566a"]],
  ESTHETIQUE: [["#326358", "#6fa79a"], ["#3f7d70", "#8fbfb4"]],
  SPA: [["#8a4b2a", "#c08552"], ["#6d3a20", "#a86f43"]],
}

/** Décalages du motif, pour que deux salons ne le placent pas au même endroit. */
const ANCRAGES = ["-12% -18%", "62% -22%", "-18% 48%", "70% 55%"]

export function couleursSalon(salon) {
  const variantes = PALETTES[salon?.categorie] ?? PALETTES.COIFFURE
  const h = empreinte(`${salon?.nom ?? ""}${salon?.id ?? ""}`)
  const [sombre, clair] = variantes[h % variantes.length]
  return { sombre, clair, ancrage: ANCRAGES[(h >> 3) % ANCRAGES.length] }
}
