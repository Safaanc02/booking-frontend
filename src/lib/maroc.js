import { ZONE } from "./format"

/**
 * L'heure du Maroc, et ce qu'elle implique.
 *
 * Trois écrans en dépendent — l'accueil public, le tableau de bord et le
 * panneau de connexion de Keycloak — et deux d'entre eux vivent dans ce
 * dépôt. Les garder ici évite que l'un annonce des salons ouverts pendant
 * que l'autre les dit fermés : c'est arrivé sur un simple écart de constante.
 */

/** Amplitude d'ouverture courante des salons du réseau, en heures locales. */
export const OUVERTURE = [9, 19]

/**
 * L'heure de Casablanca, en nombre.
 *
 * Par formatToParts et non par format : en français, `format` rend l'heure
 * seule sous la forme « 01 h ». Number() en tirait NaN, toute comparaison
 * devenait fausse, et la page annonçait des salons ouverts à deux heures du
 * matin — exactement le contraire de ce qu'elle est censée démontrer.
 */
export const heureCasablanca = () => Number(
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false, timeZone: ZONE })
    .formatToParts(new Date())
    .find((part) => part.type === "hour")?.value)

/** « 14:32 » à Casablanca. */
export const minuteCasablanca = () =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })
    .format(new Date())

/** Les salons du réseau sont-ils ouverts à cet instant ? */
export const salonsOuverts = (h = heureCasablanca()) =>
  h >= OUVERTURE[0] && h < OUVERTURE[1]

/**
 * Le moment de la journée, pour saluer quelqu'un.
 *
 * Coupé à 18 h et non à 20 h : au Maroc « bonsoir » se dit dès la fin
 * d'après-midi, bien avant que le soleil ne se couche.
 */
export const salutation = (h = heureCasablanca()) =>
  h < 18 ? "Bonjour" : "Bonsoir"

/** La date du jour à Casablanca, en AAAA-MM-JJ — le format attendu par l'API. */
export const aujourdhui = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date())
