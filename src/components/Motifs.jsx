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

/**
 * Étoile à N branches, sommets alternés sur deux rayons.
 *
 * Un polygone et non deux carrés superposés. Les deux carrés donnaient un
 * octogone à angles droits — géométrique, mais plat : ce qui manquait était
 * la pointe. Le khatem du zellige est une étoile pointue, et c'est cette
 * pointe qu'on reconnaît.
 */
const etoile = (cx, cy, rExt, rInt, branches, cle) => {
  const points = []
  for (let i = 0; i < branches * 2; i++) {
    const a = (Math.PI * i) / branches - Math.PI / 2
    const r = i % 2 === 0 ? rExt : rInt
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return <polygon key={cle} points={points.join(" ")} />
}

/**
 * Trame de zellige.
 *
 * Grandes étoiles aux nœuds du réseau, petites en quinconce entre elles.
 * C'est l'alternance du zellige marocain, et non une simple répétition : une
 * seule taille d'étoile donne un papier peint, deux tailles imbriquées
 * donnent un entrelacs.
 *
 * Les étoiles des bords sont volontairement coupées par la tuile : c'est ce
 * qui fait que le motif se raccorde sans couture quand le navigateur le
 * répète.
 */
export function TrameZellige({ id, taille = 120, className = "", style }) {
  const t = taille
  const c = t / 2
  // Proportions fixées sur la tuile : le motif garde le même dessin à
  // n'importe quelle échelle, seule sa densité change.
  const gExt = t * 0.30, gInt = t * 0.125
  const pExt = t * 0.125, pInt = t * 0.058

  return (
    <svg aria-hidden className={className} style={style}>
      <defs>
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.2">
            {[[0, 0], [t, 0], [0, t], [t, t], [c, c]]
              .map(([x, y], i) => etoile(x, y, gExt, gInt, 8, `g${i}`))}
            {[[c, 0], [0, c], [t, c], [c, t]]
              .map(([x, y], i) => etoile(x, y, pExt, pInt, 8, `p${i}`))}
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

/**
 * Bandeau de zellige, en séparation de sections.
 *
 * Une frise de quelques pixels qui coupe la page franchement, au lieu du
 * filet gris habituel. C'est le motif employé comme ponctuation : il donne
 * un rythme là où les sections se succédaient sans transition.
 */
export function FriseZellige({ id, className = "", hauteur = "h-6" }) {
  return (
    <div className={`relative overflow-hidden ${hauteur} ${className}`}>
      <TrameZellige
        id={id}
        taille={44}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
