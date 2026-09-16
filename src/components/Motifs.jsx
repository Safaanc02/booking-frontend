/**
 * Motifs géométriques du site.
 *
 * Dessinés en SVG et non importés comme images : rien à télécharger, aucune
 * pixellisation à l'agrandissement, et la couleur suit celle du texte — un
 * même motif sert donc sur fond clair comme sur fond terracotta.
 *
 * La figure de base est l'arche outrepassée, celle des riads et des hammams.
 * Elle a remplacé la trame d'étoiles de zellige, qui ne fonctionnait pas : ces
 * étoiles étaient *posées* sur un fond, alors que le vrai zellige est une
 * tessellation — les formes s'emboîtent bord à bord, sans fond visible entre
 * elles. D'où cet air de papier peint piquant, qui se remarquait d'autant plus
 * derrière du texte.
 *
 * L'arche règle cela autrement : elle est marocaine par l'architecture plutôt
 * que par le carrelage, ce qui est moins attendu, et une arcature répétée est
 * calme par nature — des courbes parallèles, aucune pointe.
 */

/**
 * Arcature : des arches outrepassées, répétées.
 *
 * Deux arches emboîtées par tuile, l'une dans l'autre : une seule donnerait
 * une rangée de tunnels, deux donnent l'épaisseur d'un mur et un rythme
 * intérieur. Les pieds descendent sous la tuile, si bien que le motif se
 * raccorde sans couture quand le navigateur le répète.
 *
 * `taille` fixe la largeur d'une arche ; la hauteur en découle, dans la
 * proportion d'une arche outrepassée — plus haute que large, comme dans les
 * bâtiments dont elle vient.
 */
export function Arcature({ id, taille = 96, className = "", style }) {
  const l = taille
  const h = Math.round(l * 1.25)
  // Proportions exprimées en fraction de la tuile : le dessin reste le même à
  // n'importe quelle échelle, seule la densité change.
  const m = l * 0.083          // marge latérale de l'arche extérieure
  const ep = l * 0.167         // épaisseur du mur, entre les deux arches
  const epaule = h * 0.483     // hauteur des épaules, où la courbe commence
  const sommet = h * 0.050     // hauteur du sommet

  const arche = (x0, x1, yEpaule, ySommet) => {
    const cx = (x0 + x1) / 2
    // Le dépassement horizontal fait le fer à cheval : sans lui, l'arche est
    // un simple plein cintre, et c'est ce détail qui la situe au Maroc.
    const debord = (x1 - x0) * 0.09
    return `M${x0} ${h} L${x0} ${yEpaule}`
      + ` C${x0 - debord} ${yEpaule * 0.42} ${cx - (cx - x0) * 0.62} ${ySommet} ${cx} ${ySommet}`
      + ` C${cx + (x1 - cx) * 0.62} ${ySommet} ${x1 + debord} ${yEpaule * 0.42} ${x1} ${yEpaule}`
      + ` L${x1} ${h}`
  }

  return (
    <svg aria-hidden className={className} style={style}>
      <defs>
        <pattern id={id} width={l} height={h} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
            <path d={arche(m, l - m, epaule, sommet)} />
            <path d={arche(m + ep, l - m - ep, epaule + h * 0.09, sommet + h * 0.17)} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * L'arche seule, comme marque.
 *
 * Sert de ponctuation entre un titre et son complément, là où l'on aurait mis
 * un point médian sans caractère. Elle remplace l'étoile à huit branches qui
 * tenait ce rôle : garder une étoile après avoir retiré la trame d'étoiles
 * aurait laissé un vestige de l'identité précédente, visible surtout parce
 * qu'il ne renvoyait plus à rien.
 *
 * Pleine et non au trait : à douze pixels, un contour de 1 px se réduit à une
 * tache grise.
 */
export function MarqueArche({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M4 22 L4 11 C4 5.5 7.6 2 12 2 C16.4 2 20 5.5 20 11 L20 22 Z"
      />
    </svg>
  )
}

/**
 * Bandeau d'arcature, en séparation de sections.
 *
 * Une frise de quelques pixels qui coupe la page franchement, au lieu du
 * filet gris habituel. C'est le motif employé comme ponctuation : il donne
 * un rythme là où les sections se succédaient sans transition.
 */
export function FriseArcature({ id, className = "", hauteur = "h-6" }) {
  return (
    <div className={`relative overflow-hidden ${hauteur} ${className}`}>
      <Arcature id={id} taille={38} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
