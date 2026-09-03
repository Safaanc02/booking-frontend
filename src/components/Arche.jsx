/**
 * Contenant en forme d'arche.
 *
 * L'arche outrepassée est la signature de l'architecture marocaine et
 * andalouse — les portes de médina, les riads, les hammams. Employée comme
 * découpe, elle situe le produit en un coup d'œil, là où une carte à coins
 * arrondis pourrait appartenir à n'importe quelle application au monde.
 *
 * La forme retenue n'est pas le fer à cheval géométrique. Tracé fidèlement,
 * son point le plus large passe sous la naissance des jambages, ce qui donne
 * une silhouette de trou de serrure : très juste, et inutilisable pour tenir
 * du contenu. Ces deux courbes de Bézier gardent le dôme légèrement ogival et
 * un intérieur généreux.
 *
 * clipPathUnits="objectBoundingBox" : le tracé est exprimé de 0 à 1 et suit
 * donc n'importe quelle taille de boîte, sans recalcul.
 */
const TRACE = "M0.08 1 L0.08 0.46 C0.08 0.20 0.24 0.02 0.5 0.02 C0.76 0.02 0.92 0.20 0.92 0.46 L0.92 1 Z"

/**
 * Le tracé est déclaré une seule fois pour toute l'application.
 *
 * À poser une fois dans la mise en page racine. Le déclarer par composant
 * multiplierait des définitions identiques, et deux clipPath de même
 * identifiant feraient tous pointer sur le premier.
 */
export function DefinitionArche() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <clipPath id="arche" clipPathUnits="objectBoundingBox">
          <path d={TRACE} />
        </clipPath>
      </defs>
    </svg>
  )
}

export default function Arche({ className = "", style, children }) {
  return (
    <div
      className={className}
      style={{ clipPath: "url(#arche)", WebkitClipPath: "url(#arche)", ...style }}
    >
      {children}
    </div>
  )
}

/** L'arche en trait, comme ornement. Le fer à cheval y est assumé. */
export function ArcheTrait({ className = "" }) {
  return (
    <svg viewBox="0 0 40 48" aria-hidden className={className} fill="none"
         stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M7 47V21a13 13 0 0 1 26 0v26" />
      <path d="M13.5 47V22a6.5 6.5 0 0 1 13 0v25" />
    </svg>
  )
}
