/**
 * Motifs géométriques du site.
 *
 * Dessinés en SVG et non importés comme images : rien à télécharger, aucune
 * pixellisation à l'agrandissement, et la couleur suit celle du texte — un
 * même motif sert donc sur fond clair comme sur fond bordeaux.
 *
 * La figure de base est l'étoile à huit branches, le khatem du zellige : deux
 * carrés superposés, l'un tourné d'un huitième de tour. C'est le vocabulaire
 * visuel des lieux dont ce site parle, et il ne coûte que deux rectangles.
 */

/** Une étoile à huit branches, en deux carrés. */
const etoile = (cx, cy, cote, cle) => {
  const x = cx - cote / 2
  const y = cy - cote / 2
  return (
    <g key={cle}>
      <rect x={x} y={y} width={cote} height={cote} rx={cote * 0.06} />
      <rect x={x} y={y} width={cote} height={cote} rx={cote * 0.06}
            transform={`rotate(45 ${cx} ${cy})`} />
    </g>
  )
}

/**
 * Trame de zellige, en fond.
 *
 * Les étoiles des quatre coins sont volontairement coupées par la tuile :
 * c'est ce qui fait que le motif se raccorde sans couture quand le navigateur
 * le répète.
 */
export function TrameZellige({ id, taille = 64, className = "", style }) {
  const c = taille / 2
  const cote = taille * 0.42
  return (
    <svg aria-hidden className={className} style={style}>
      <defs>
        <pattern id={id} width={taille} height={taille} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            {[[0, 0], [taille, 0], [0, taille], [taille, taille], [c, c]]
              .map(([x, y], i) => etoile(x, y, cote, i))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * L'étoile seule, comme marque.
 *
 * Sert de ponctuation entre un titre et son complément, là où l'on aurait mis
 * un point médian sans caractère.
 */
export function EtoileHuit({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="1" />
        <rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(45 12 12)" />
      </g>
    </svg>
  )
}
