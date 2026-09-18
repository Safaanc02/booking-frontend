/**
 * Motifs du site.
 *
 * Dessinés en SVG et non importés comme images : rien à télécharger, aucune
 * pixellisation à l'agrandissement, et la couleur peut suivre celle du texte —
 * un même motif sert donc sur fond clair comme sur fond terracotta.
 *
 * ---- Ce que trois essais ont appris ----
 *
 * La trame d'étoiles de zellige échouait pour une raison de fond : ces étoiles
 * étaient *posées* sur un fond, alors que le vrai zellige est une
 * tessellation, où les formes s'emboîtent sans fond visible entre elles. D'où
 * un rendu piquant, gênant derrière du texte. L'arcature qui l'a remplacée
 * était calme, mais froide : une rangée de portes. Les fleurs qui ont suivi
 * étaient chaleureuses, et interchangeables — n'importe quel institut de
 * beauté aurait pu les prendre.
 *
 * Le motif vient donc désormais du produit et non du secteur : la grille d'un
 * agenda, dont quelques créneaux sont pris. C'est ce que le logo dessine déjà
 * — un calendrier et sa coche — et c'est ce que l'application fait. Un salon
 * qui la découvre y reconnaît son métier ; aucun concurrent ne peut reprendre
 * ce motif sans reprendre l'idée.
 *
 * ---- Les noms disent le rôle, pas le dessin ----
 *
 * `Semis`, `Marque`, `Panneau`, `Frise`. Les précédents s'appelaient
 * `SemisFleurs` et `MarqueFleur` : chaque changement de motif obligeait alors
 * à toucher les dix endroits qui les appellent, pour un dessin qu'eux ne
 * regardent pas. Trois motifs en une saison suffisent à trancher la question.
 */

/*
 * Les créneaux pris dans une tuile de quatre colonnes sur sept rangs.
 *
 * Choisis épars : trois pris côte à côte redonneraient un bloc, et une
 * diagonale régulière se lirait comme une rayure à la répétition.
 *
 * Quatre sur sept et non trois sur cinq : une grille ne se lit comme un
 * agenda que si l'on en voit le rythme. À la taille du bandeau d'accueil, la
 * tuile plus lâche ne montrait que quelques rectangles épars — des taches,
 * pas des heures.
 */
const PRIS = [[0, 2], [1, 5], [3, 0], [2, 3], [1, 1], [3, 4], [0, 6]]
const COLONNES = 4
const RANGS = 7

/**
 * Semis de créneaux : la texture répétable.
 *
 * Des filets fins, comme les lignes d'heures d'un agenda, et quelques
 * créneaux pris. De loin c'est une trame ; de près on reconnaît une journée.
 *
 * La régularité est assumée ici, à l'inverse des motifs précédents : un
 * agenda *est* une grille, et l'irrégularité vient de ce qui y est réservé,
 * pas de la grille elle-même.
 *
 * `couleurs` nulle : tout est dessiné dans la couleur du texte, à des opacités
 * différentes. C'est ce qui permet au même semis de vivre en blanc sur le
 * bandeau terracotta, et en vert sur le bandeau sauge.
 */
export function Semis({ id, taille = 190, className = "", style, couleurs = null }) {
  const l = taille
  const h = Math.round(l * 0.79)
  const colL = l / COLONNES
  const rangH = h / RANGS
  const marge = colL * 0.16
  const creneauH = rangH * 0.46
  const largeur = colL - marge * 2
  const rayon = Math.min(creneauH / 2.6, largeur / 8)
  const c = couleurs ?? []

  /*
   * Le filet d'un créneau libre : la ligne d'heure, pas un cadre. Un contour
   * complet ferait vingt-huit petites boîtes par tuile — un tableur, pas un
   * agenda.
   *
   * Son opacité est proche de celle des créneaux pris, et c'est voulu : les
   * appelants posent le semis à 25 % ou moins, ce qui multiplie les deux. Trop
   * discrets, les filets disparaissaient et il ne restait que les blocs, sans
   * la grille qui leur donne un sens.
   */
  const filets = []
  const prises = []
  for (let col = 0; col < COLONNES; col++) {
    for (let rang = 0; rang < RANGS; rang++) {
      const x = col * colL + marge
      const y = rang * rangH + (rangH - creneauH) / 2
      const estPris = PRIS.some(([a, b]) => a === col && b === rang)
      if (estPris) {
        prises.push(
          <rect
            key={`p${col}-${rang}`}
            x={x} y={y} width={largeur} height={creneauH} rx={rayon}
            fill={couleurs ? c[prises.length % c.length] : "currentColor"}
            opacity={couleurs ? 0.46 : 0.42 + (rang % 3) * 0.05}
          />)
      } else {
        filets.push(
          <rect
            key={`f${col}-${rang}`}
            x={x} y={y + creneauH} width={largeur} height={Math.max(1, l * 0.006)}
            fill="currentColor" opacity="0.34"
          />)
      }
    }
  }

  return (
    <svg aria-hidden className={className} style={style}>
      <defs>
        <pattern id={id} width={l} height={h} patternUnits="userSpaceOnUse">
          {filets}
          {prises}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * La case cochée, comme marque.
 *
 * Sert de ponctuation entre un titre et son complément, là où l'on aurait mis
 * un point médian sans caractère. C'est le logo réduit à son geste.
 *
 * Un seul tracé, la coche évidée par `evenodd` plutôt que peinte par-dessus :
 * à douze pixels, une coche dessinée en blanc disparaîtrait sur un fond
 * ivoire et virerait au gris sur un fond coloré. Évidée, elle prend la
 * couleur de ce qu'il y a derrière, quelle qu'elle soit.
 */
export function Marque({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5 1 H19 A4 4 0 0 1 23 5 V19 A4 4 0 0 1 19 23 H5 A4 4 0 0 1 1 19 V5 A4 4 0 0 1 5 1 Z
           M6.8 12.4 L9 10.2 L10.6 11.8 L15.2 7.2 L17.4 9.4 L10.6 16.2 Z"
      />
    </svg>
  )
}

/*
 * Une semaine qui se remplit : un créneau pris de plus chaque jour.
 *
 * Lundi n'en a qu'un, dimanche presque tous. C'est la promesse faite au
 * gérant, dessinée plutôt qu'écrite — et cela donne au panneau une direction,
 * là où une grille remplie au hasard n'aurait été qu'une texture agrandie.
 */
const SEMAINE = [
  [5],
  [2, 6],
  [1, 4, 7],
  [0, 3, 5, 6],
  [1, 2, 4, 5, 7],
  [0, 1, 3, 4, 6, 7],
  [0, 2, 3, 4, 5, 6, 7],
]

/**
 * Le panneau : un geste, pas une trame.
 *
 * Positionné par l'appelant, jamais répété : il vaut par sa taille et par le
 * fait qu'il n'y en a qu'un.
 */
export function Panneau({ className = "", style, taille = 340 }) {
  const L = 280
  const H = 220
  const colL = L / 7
  const rangH = H / 8
  const marge = colL * 0.16
  const creneauH = rangH * 0.52
  const largeur = colL - marge * 2

  const cases = []
  for (let jour = 0; jour < 7; jour++) {
    for (let rang = 0; rang < 8; rang++) {
      const x = jour * colL + marge
      const y = rang * rangH + (rangH - creneauH) / 2
      const pris = SEMAINE[jour].includes(rang)
      cases.push(
        <rect
          key={`${jour}-${rang}`}
          x={x} y={y} width={largeur} height={creneauH} rx={creneauH / 2.6}
          fill={pris ? "var(--panneau-pris, #d3a29d)" : "var(--panneau-libre, #eec3a8)"}
          opacity={pris ? 0.62 : 0.17}
        />)
    }
  }

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${L} ${H}`}
      className={className}
      style={{ width: taille, height: taille * (H / L), ...style }}
    >
      {cases}
    </svg>
  )
}

/**
 * Frise, en séparation de sections.
 *
 * Une bande de quelques pixels qui coupe la page franchement, au lieu du
 * filet gris habituel.
 */
export function Frise({ id, className = "", hauteur = "h-6" }) {
  return (
    <div className={`relative overflow-hidden ${hauteur} ${className}`}>
      <Semis id={id} taille={74} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
