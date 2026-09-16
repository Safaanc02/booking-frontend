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
/*
 * Une famille de couleurs par métier, tirée des cinq de la marque.
 *
 * Chaque bandeau est un dégradé du sombre vers le clair : la version sombre
 * porte le texte blanc des pastilles posées dessus, la claire donne la
 * lumière. Les cinq teintes de la palette ne pouvaient pas jouer les deux
 * rôles — sur blanc, quatre d'entre elles plafonnent sous 2,4:1 —, chacune a
 * donc sa nuance foncée dérivée de la même teinte.
 *
 * Les cinq métiers sont écartés en teinte autant qu'en clarté : un bandeau
 * doit se reconnaître sans lire l'étiquette. La première version donnait au
 * barbier et à l'onglerie deux roses voisins, et les deux cartes devenaient
 * indiscernables côte à côte dans une page de résultats — ce qui ôtait à ces
 * couleurs leur seule raison d'être.
 *
 * Terracotta pour la coiffure, qui est la couleur de la marque et le métier
 * le plus courant ; vert sombre pour le barbier, seul registre neutre de la
 * palette et qui va au métier ; rose pour l'onglerie ; menthe pour
 * l'esthétique ; pêche pour le hammam. Deux variantes chacune, pour que deux
 * salons voisins du même métier ne se ressemblent pas trait pour trait.
 */
const PALETTES = {
  COIFFURE: [["#5d2f19", "#ac6039"], ["#774228", "#bb7958"]],
  ONGLERIE: [["#8d3f46", "#bb8186"], ["#9f565c", "#c5a5a7"]],
  SPA: [["#dd8a40", "#eac5a4"], ["#dc9f6a", "#f0ddcc"]],
  BARBIER: [["#293d31", "#5e7869"], ["#3f5046", "#788c80"]],
  ESTHETIQUE: [["#52986a", "#9bbfa7"], ["#70a481", "#bccdc2"]],
}

/** Décalages du motif, pour que deux salons ne le placent pas au même endroit. */
const ANCRAGES = ["-12% -18%", "62% -22%", "-18% 48%", "70% 55%"]

export function couleursSalon(salon) {
  const variantes = PALETTES[salon?.categorie] ?? PALETTES.COIFFURE
  const h = empreinte(`${salon?.nom ?? ""}${salon?.id ?? ""}`)
  const [sombre, clair] = variantes[h % variantes.length]
  return { sombre, clair, ancrage: ANCRAGES[(h >> 3) % ANCRAGES.length] }
}
