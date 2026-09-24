/**
 * Position de la personne qui cherche, demandée au navigateur.
 *
 * Trois exigences ont façonné ce module :
 *
 * 1. La position ne sert qu'à classer des salons. Elle part donc arrondie au
 *    millième de degré — cent mètres environ. C'est assez pour dire quel salon
 *    est le plus proche, et bien trop grossier pour désigner un domicile. La
 *    coordonnée voyage dans l'URL d'une requête : ce qu'on n'y met pas ne peut
 *    ni être journalisé ni être mis en cache par un intermédiaire.
 *
 * 2. Chaque échec a sa phrase. « Impossible de vous localiser » n'apprend rien
 *    à qui vient de refuser l'autorisation, ni à qui navigue en HTTP simple.
 *    Un refus se répare dans les réglages du navigateur, une panne de capteur
 *    en réessayant : ce ne sont pas les mêmes gestes.
 *
 * 3. Rien n'est demandé avant que la personne ne le demande. Aucune invite au
 *    chargement de la page.
 */

/** Cent mètres environ : la précision utile pour classer, et pas plus. */
const DECIMALES = 3

export const RAISONS = {
  NON_DISPONIBLE: "non_disponible",
  REFUSEE: "refusee",
  INDISPONIBLE: "indisponible",
  DELAI: "delai",
}

const MESSAGES = {
  [RAISONS.NON_DISPONIBLE]:
    "Votre navigateur ne partage pas votre position sur une page non sécurisée. Choisissez votre ville dans la liste.",
  [RAISONS.REFUSEE]:
    "L’accès à votre position a été refusé. Vous pouvez l’autoriser dans les réglages du navigateur, ou choisir votre ville dans la liste.",
  [RAISONS.INDISPONIBLE]:
    "Votre position n’a pas pu être déterminée. Choisissez votre ville dans la liste.",
  [RAISONS.DELAI]:
    "La localisation a pris trop de temps. Réessayez, ou choisissez votre ville dans la liste.",
}

export class ErreurGeolocalisation extends Error {
  constructor(raison) {
    super(MESSAGES[raison] ?? MESSAGES[RAISONS.INDISPONIBLE])
    this.name = "ErreurGeolocalisation"
    this.raison = raison
  }
}

const arrondir = (valeur) => Number(valeur.toFixed(DECIMALES))

/**
 * Demande la position au navigateur.
 *
 * @returns {Promise<{lat: number, lng: number}>} coordonnées arrondies
 * @throws {ErreurGeolocalisation}
 */
export function localiser({ delaiMs = 12000 } = {}) {
  // Absent, et non refusé : les navigateurs retirent l'API sur une origine non
  // sécurisée. Sans ce test, l'appel lèverait un TypeError et la page
  // afficherait une erreur technique là où il faut expliquer le HTTPS.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new ErreurGeolocalisation(RAISONS.NON_DISPONIBLE))
  }

  return new Promise((resoudre, rejeter) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resoudre({ lat: arrondir(coords.latitude), lng: arrondir(coords.longitude) }),
      (erreur) => {
        const raison =
          erreur.code === erreur.PERMISSION_DENIED ? RAISONS.REFUSEE
          : erreur.code === erreur.TIMEOUT ? RAISONS.DELAI
          : RAISONS.INDISPONIBLE
        rejeter(new ErreurGeolocalisation(raison))
      },
      {
        // La haute précision allume le GPS : plusieurs secondes d'attente et de
        // batterie pour gagner des mètres dont ce classement n'a que faire.
        enableHighAccuracy: false,
        timeout: delaiMs,
        // Une position vieille de cinq minutes convient : on n'a pas changé de
        // quartier, et la réponse est immédiate.
        maximumAge: 5 * 60 * 1000,
      },
    )
  })
}

/**
 * « moins de 1 km », « 3 km », « 27 km ».
 *
 * Au kilomètre entier, et pas plus fin, parce que le point du salon est le
 * centre de son quartier tant que ses coordonnées n'ont pas été relevées :
 * afficher « à 2,4 km » donnerait une précision que la donnée ne porte pas.
 * Le classement, lui, se fait sur la valeur exacte — c'est l'affichage seul
 * qui s'arrondit.
 */
export function distanceLisible(km) {
  if (km == null || Number.isNaN(km)) return null
  if (km < 1) return "moins de 1 km"
  return `${Math.round(km)} km`
}

/**
 * Lit une paire de coordonnées collée depuis une carte.
 *
 * Google Maps, sur un clic droit, propose « 33.5883, -7.6222 » et le met dans
 * le presse-papiers d'un clic. C'est ce que colle une personne qui relève la
 * position d'un salon, et deux champs séparés l'obligeraient à couper la
 * chaîne à la main — occasion parfaite d'inverser latitude et longitude.
 *
 * Le séparateur décimal est le point, pas la virgule : avec des virgules
 * partout, « 33,5883, -7,6222 » ne se découpe plus de façon certaine. Le
 * format refusé est signalé plutôt que devinné.
 *
 * @returns {{lat: number, lng: number} | null} null si la chaîne est vide
 * @throws {Error} si la chaîne ne se lit pas comme une position au Maroc
 */
export function analyserCoordonnees(texte) {
  const brut = (texte ?? "").trim()
  if (!brut) return null

  const nombres = brut.match(/-?\d+(?:\.\d+)?/g) ?? []
  if (nombres.length !== 2) {
    throw new Error("Attendu deux nombres séparés par une virgule, par exemple 33.5883, -7.6222")
  }

  const [lat, lng] = nombres.map(Number)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Coordonnées hors du globe")
  }
  // Le Maroc tient dans cette fenêtre, Sahara compris. Un point au-dehors est
  // presque toujours une latitude et une longitude inversées — l'erreur la
  // plus facile à faire, et la plus difficile à repérer ensuite : le salon
  // part se placer en mer sans que rien ne l'indique.
  const dansLePays = lat >= 20 && lat <= 36.5 && lng >= -17.5 && lng <= -0.5
  if (!dansLePays) {
    throw new Error(
      `Ce point (${lat}, ${lng}) est hors du Maroc. Vérifiez l’ordre : la latitude d’abord.`)
  }

  return { lat, lng }
}
