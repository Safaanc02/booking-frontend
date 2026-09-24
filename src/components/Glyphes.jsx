/**
 * Pictogrammes des métiers.
 *
 * Ils remplacent les emoji qui tenaient ce rôle. Un emoji n'est pas un
 * dessin : son rendu appartient au système d'exploitation, change d'une
 * machine à l'autre, ignore la couleur de la marque et arrive presque
 * toujours dans un style — bombé, coloré, enfantin — qui jure avec le reste
 * de la page. Ces traits-là suivent la couleur du texte et s'alignent sur la
 * même graisse que les bordures du site.
 *
 * Registre volontairement local : l'arche outrepassée du hammam vaut mieux
 * qu'une baignoire, et l'enseigne tournante dit le barbier sans détour.
 */
const TRAIT = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
}

const Dessin = ({ className = "", children }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} {...TRAIT}>
    {children}
  </svg>
)

/** Ciseaux : deux anneaux, deux lames croisées. */
export const Coiffure = (p) => (
  <Dessin {...p}>
    <circle cx="6.5" cy="18" r="2.4" />
    <circle cx="17.5" cy="18" r="2.4" />
    <path d="M8.2 16.2 18.5 4.5" />
    <path d="M15.8 16.2 5.5 4.5" />
  </Dessin>
)

/** Enseigne de barbier : le fût, ses spirales et ses embouts. */
export const Barbier = (p) => (
  <Dessin {...p}>
    <rect x="8.5" y="5.5" width="7" height="13" rx="3.5" />
    <path d="M9.2 11.6 14.8 8.8M9.2 15.6 14.8 12.8" />
    <path d="M7.5 4.2h9M7.5 19.8h9" />
  </Dessin>
)

/** Flacon de vernis : le corps, le col, le bouchon. */
export const Onglerie = (p) => (
  <Dessin {...p}>
    <rect x="10" y="2.6" width="4" height="3.6" rx="1" />
    <path d="M12 6.2v1.8" />
    <path d="M8.4 8h7.2v9.6a2.4 2.4 0 0 1-2.4 2.4h-2.4a2.4 2.4 0 0 1-2.4-2.4z" />
    <path d="M8.4 13.4h7.2" />
  </Dessin>
)

/** Goutte de soin, et son reflet. */
export const Esthetique = (p) => (
  <Dessin {...p}>
    <path d="M12 3.2c3.4 3.9 5.2 6.6 5.2 9.1a5.2 5.2 0 0 1-10.4 0c0-2.5 1.8-5.2 5.2-9.1z" />
    <path d="M9.6 13.1a2.4 2.4 0 0 0 2.4 2.4" />
  </Dessin>
)

/** Arche outrepassée, et la vapeur qui s'en échappe. */
export const Hammam = (p) => (
  <Dessin {...p}>
    <path d="M6.5 20.5v-4.8a5.5 5.5 0 0 1 11 0v4.8" />
    <path d="M9.8 20.5v-4.8a2.2 2.2 0 0 1 4.4 0v4.8" />
    <path d="M10 8.4c0-1.2 1.4-1.5 1.4-2.7S10 4.2 10 3" />
    <path d="M14 8.4c0-1.2 1.4-1.5 1.4-2.7S14 4.2 14 3" />
  </Dessin>
)

/** Horloge : sert à dire « à toute heure », sans emoji de réveil. */
export const Horloge = (p) => (
  <Dessin {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3.2 2" />
  </Dessin>
)

/** Étiquette de prix. */
export const Etiquette = (p) => (
  <Dessin {...p}>
    <path d="M12.6 3.4H20v7.4l-8.8 8.8a1.7 1.7 0 0 1-2.4 0l-5-5a1.7 1.7 0 0 1 0-2.4z" />
    <circle cx="16.4" cy="7" r="1.2" />
  </Dessin>
)

/** Enveloppe : le rappel de la veille. */
export const Rappel = (p) => (
  <Dessin {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
    <path d="M3.6 7 12 13.2 20.4 7" />
  </Dessin>
)

/**
 * Boussole : un cercle, une aiguille.
 *
 * Préférée à la goutte d'épingle de carte, trop associée aux cartes
 * elles-mêmes — il n'y a pas de carte ici, seulement un classement par
 * distance. L'aiguille dit la direction, pas un point posé sur un plan.
 *
 * Aiguille pleine et rose des vents supprimée : ce glyphe s'affiche à 14 et
 * 16 pixels, dans un bouton et sur une pastille de carte. La première version
 * cernait l'aiguille au trait et ajoutait quatre repères cardinaux — à cette
 * taille, quatre traits de 1,4 px et un quadrilatère vide se confondent en une
 * tache. Le plein tient la petite taille, le trait non.
 */
export const Boussole = (p) => (
  <Dessin {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M16.4 7.6 13.1 13.1 7.6 16.4 10.9 10.9Z" fill="currentColor" stroke="none" />
  </Dessin>
)
