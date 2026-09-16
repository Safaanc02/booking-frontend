/**
 * Motifs du site.
 *
 * Dessinés en SVG et non importés comme images : rien à télécharger, aucune
 * pixellisation à l'agrandissement, et la couleur peut suivre celle du texte —
 * un même motif sert donc sur fond clair comme sur fond terracotta.
 *
 * Deux essais ont précédé celui-ci, et ce qu'ils ont appris tient en une
 * phrase : un motif de fond ne doit pas avoir l'air d'un papier peint.
 *
 * La trame d'étoiles de zellige échouait pour une raison de fond — ces étoiles
 * étaient *posées* sur un fond, alors que le vrai zellige est une
 * tessellation, où les formes s'emboîtent sans fond visible entre elles. D'où
 * un rendu piquant, d'autant plus gênant derrière du texte. L'arcature qui l'a
 * remplacée était calme, mais froide : une rangée de portes.
 *
 * Le registre est donc désormais floral et solaire. Deux objets, deux rôles
 * distincts : une rosace rayonnante comme geste unique dans un grand bandeau,
 * et un semis de fleurs comme texture répétable partout ailleurs. Une grande
 * rosace ne se répète pas ; un semis ne fait pas un geste.
 */

/**
 * Pétales arrondis disposés en couronne.
 *
 * `n` pétales, chacun une goutte engendrée par deux courbes symétriques puis
 * tournée. Arrondi et non pointu : c'est toute la différence avec l'étoile de
 * zellige — une pointe est géométrique, un pétale est vivant.
 */
const petales = (n, rayon, largeur, cle = "p") =>
  Array.from({ length: n }, (_, i) => (
    <path
      key={`${cle}${i}`}
      transform={`rotate(${(360 * i) / n})`}
      d={`M0 0 C ${largeur} ${-rayon * 0.42} ${largeur} ${-rayon * 0.72} 0 ${-rayon}`
        + ` C ${-largeur} ${-rayon * 0.72} ${-largeur} ${-rayon * 0.42} 0 0 Z`}
    />
  ))

/**
 * La rosace-soleil : un geste, pas une trame.
 *
 * Deux couronnes de pétales et un cœur. La couronne extérieure, à seize
 * pétales fins, fait le rayonnement ; l'intérieure, à huit pétales larges,
 * fait la fleur. C'est la même figure lue de deux façons, et c'est ce qui la
 * rend solaire sans être un soleil dessiné.
 *
 * Positionnée par l'appelant, jamais répétée : elle vaut par sa taille et par
 * le fait qu'il n'y en a qu'une.
 */
export function RosaceSoleil({ className = "", style, taille = 340 }) {
  const r = taille / 2
  return (
    <svg
      aria-hidden
      viewBox="-200 -200 400 400"
      className={className}
      style={{ width: taille, height: taille, ...style }}
    >
      <g fill="var(--rosace-rayons, #eec3a8)" opacity="0.62">{petales(16, 190, 30, "r")}</g>
      <g fill="var(--rosace-petales, #d3a29d)" opacity="0.52">{petales(8, 112, 35, "f")}</g>
      <circle r={r * 0.10} fill="var(--rosace-coeur, #e8b298)" opacity="0.78" />
    </svg>
  )
}

/**
 * Semis de fleurs : la texture répétable.
 *
 * Quatre fleurs par tuile, à des tailles, des angles et des couleurs
 * différents. L'irrégularité est le point : quatre fleurs identiques alignées
 * redonneraient un papier peint, et c'est précisément ce qu'on cherche à
 * éviter. Aucune ne touche le bord au même endroit, si bien que la répétition
 * ne se lit pas.
 *
 * `couleurs` nulle : tout est dessiné dans la couleur du texte, avec des
 * opacités différentes. C'est ce qui permet au même semis de vivre sur le
 * bandeau terracotta en blanc, et sur un fond clair en rose.
 */
export function SemisFleurs({ id, taille = 190, className = "", style, couleurs = null }) {
  const l = taille
  const h = Math.round(l * 0.79)
  const c = couleurs ?? []
  const teinte = (i, opaciteParDefaut) =>
    couleurs
      ? { fill: c[i % c.length], opacity: 0.46 }
      : { fill: "currentColor", opacity: opaciteParDefaut }

  return (
    <svg aria-hidden className={className} style={style}>
      <defs>
        <pattern id={id} width={l} height={h} patternUnits="userSpaceOnUse">
          <g transform={`translate(${l * 0.16} ${h * 0.24})`} {...teinte(0, 0.42)}>
            {petales(5, 17, 8, "a")}
          </g>
          <g transform={`translate(${l * 0.74} ${h * 0.69}) rotate(25)`} {...teinte(1, 0.50)}>
            {petales(5, 19, 9, "b")}
          </g>
          <g transform={`translate(${l * 0.50} ${h * 0.12}) rotate(-18) scale(0.62)`} {...teinte(2, 0.45)}>
            {petales(5, 17, 8, "c")}
          </g>
          <g transform={`translate(${l * 0.93} ${h * 0.13}) scale(0.5)`} {...teinte(0, 0.34)}>
            {petales(5, 17, 8, "d")}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * La fleur seule, comme marque.
 *
 * Sert de ponctuation entre un titre et son complément, là où l'on aurait mis
 * un point médian sans caractère. Pleine et non au trait : à douze pixels, un
 * contour de 1 px se réduit à une tache grise.
 */
export function MarqueFleur({ className = "" }) {
  return (
    <svg viewBox="-24 -24 48 48" aria-hidden className={className}>
      <g fill="currentColor">{petales(5, 20, 9, "m")}</g>
    </svg>
  )
}

/**
 * Bandeau fleuri, en séparation de sections.
 *
 * Une frise de quelques pixels qui coupe la page franchement, au lieu du
 * filet gris habituel.
 */
export function FriseFleurs({ id, className = "", hauteur = "h-6" }) {
  return (
    <div className={`relative overflow-hidden ${hauteur} ${className}`}>
      <SemisFleurs id={id} taille={74} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
