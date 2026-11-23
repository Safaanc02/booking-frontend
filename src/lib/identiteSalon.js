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

/*
 * Une famille de couleurs par métier, tirée de la palette de la marque.
 *
 * Chaque bandeau est un dégradé du sombre vers le clair : la version sombre
 * porte le texte blanc des pastilles posées dessus, la claire donne la
 * lumière. Aucune couleur de la palette ne peut jouer les deux rôles — les
 * deux plus vives plafonnent à 2,1:1 sur blanc —, chacune a donc sa nuance
 * foncée dérivée de la même teinte.
 *
 * Les cinq métiers doivent se reconnaître sans lire l'étiquette. C'est la
 * seule raison d'être de ces couleurs, et c'est là que les deux versions
 * précédentes ont échoué : barbier et onglerie se retrouvaient en roses
 * voisins, indiscernables côte à côte dans une page de résultats.
 *
 * La palette actuelle ne tient qu'une seule famille — de l'abricot à
 * l'aubergine, soixante-dix degrés de teinte en tout. Impossible d'y écarter
 * cinq métiers sur la teinte seule : il a fallu les étager aussi en clarté,
 * et chercher l'échelonnement qui maximise la plus petite distance entre eux.
 *
 * Le résultat est mesuré, pas jugé à l'œil. La paire la plus proche est à
 * ΔE 25,5 — au-delà de 20, deux surfaces se distinguent sans hésitation —
 * et chaque bandeau sombre porte le blanc au-dessus de 6,2:1.
 *
 * Deux variantes par métier, pour que deux salons voisins du même métier ne
 * se ressemblent pas trait pour trait.
 */
const PALETTES = {
  COIFFURE: [["#b2302a", "#e4a3a0"], ["#b54a45", "#e6c8c7"]],
  ONGLERIE: [["#741b29", "#dd8895"], ["#7d303c", "#dcb1b8"]],
  SPA: [["#80421e", "#e2b398"], ["#885334", "#e3ccbf"]],
  BARBIER: [["#7e3065", "#cc85b5"], ["#874572", "#cfaac3"]],
  ESTHETIQUE: [["#3d1521", "#ca728c"], ["#4c2430", "#ca9ba9"]],
}
/** Décalages du motif, pour que deux salons ne le placent pas au même endroit. */
const ANCRAGES = ["-12% -18%", "62% -22%", "-18% 48%", "70% 55%"]

export function couleursSalon(salon) {
  const variantes = PALETTES[salon?.categorie] ?? PALETTES.COIFFURE
  const h = empreinte(`${salon?.nom ?? ""}${salon?.id ?? ""}`)
  const [sombre, clair] = variantes[h % variantes.length]
  return { sombre, clair, ancrage: ANCRAGES[(h >> 3) % ANCRAGES.length] }
}

