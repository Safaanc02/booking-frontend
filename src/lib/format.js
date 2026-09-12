/** Fuseau de référence de l'application. */
export const ZONE = "Africa/Casablanca"

/** Formatage en dirhams marocains. */
export const prix = (montant) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(montant ?? 0)

/** « 45 min », « 1 h », « 1 h 30 ». */
export const duree = (minutes) => {
  if (!minutes) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

/** Numéro marocain affiché par paires : 06 12 34 56 78. */
export const telephone = (numero) => {
  if (!numero) return ""
  return numero.replace(/^\+212/, "0").replace(/\s/g, "").replace(/(\d{2})(?=\d)/g, "$1 ").trim()
}

/** « jeudi 3 septembre » */
export const jourLong = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: ZONE,
  }).format(typeof date === "string" ? new Date(`${date}T12:00:00`) : date)

/** « jeu. 3 sept. » */
export const jourCourt = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short", day: "numeric", month: "short", timeZone: ZONE,
  }).format(typeof date === "string" ? new Date(`${date}T12:00:00`) : date)

/** « jeudi 3 septembre à 14:00 » — un Instant ISO rendu en heure de Casablanca. */
export const instantLong = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: ZONE,
  }).format(d)
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: ZONE,
  }).format(d)
  return `${jour} à ${heure}`
}

/** « 14:00 » en heure de Casablanca. */
export const heureLocale = (iso) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })
    .format(new Date(iso))

/** AAAA-MM-JJ pour l'API, sans passer par UTC (toISOString décalerait la date). */
export const isoDate = (d) => {
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}


/**
 * « aujourd'hui 16:30 », « demain 09:00 », « lundi 09:00 », « 24 sept. 09:00 ».
 *
 * La précision suit l'utilité. Aujourd'hui et demain sont les deux réponses
 * qui font cliquer, et elles se disent mieux ainsi qu'avec une date. Au-delà
 * d'une semaine, le jour de la semaine ne situe plus rien — « lundi » peut
 * être dans dix jours — et il faut une date.
 */
export const quandLibre = (dateIso, heure) => {
  if (!dateIso || !heure) return null

  const jour = new Date(`${dateIso}T12:00:00`)
  const aujourdhui = new Date()
  aujourdhui.setHours(12, 0, 0, 0)
  const ecart = Math.round((jour - aujourdhui) / 86400000)
  const hhmm = String(heure).slice(0, 5)

  if (ecart <= 0) return `aujourd'hui ${hhmm}`
  if (ecart === 1) return `demain ${hhmm}`
  if (ecart <= 6) {
    return `${jour.toLocaleDateString("fr-MA", { weekday: "long", timeZone: ZONE })} ${hhmm}`
  }
  return `${jour.toLocaleDateString("fr-MA", { day: "numeric", month: "short", timeZone: ZONE })} ${hhmm}`
}

/**
 * Adresse absolue d'une ressource servie par l'API.
 *
 * L'API rend des chemins relatifs — « /api/public/photos/xyz.png » — et c'est
 * le bon choix de sa part : le site tourne derrière une seule adresse en
 * production, et un tunnel change la sienne à chaque ouverture. Une adresse
 * absolue enregistrée en base pointerait tôt ou tard vers un hôte disparu.
 *
 * Mais un chemin relatif dans un attribut `src` se résout contre l'origine de
 * la page, pas contre celle de l'API. En développement, le site est sur 5173
 * et l'API sur 8080 : le navigateur allait chercher les photos sur le site,
 * ne trouvait rien, et affichait des cadres cassés — sans que rien ne dise
 * pourquoi, puisque tout fonctionnait en production.
 *
 * axios résolvait déjà ses appels ainsi ; les images doivent faire de même.
 */
export const urlApi = (chemin) => {
  if (!chemin) return null
  if (/^https?:\/\//.test(chemin)) return chemin
  const base = import.meta.env.VITE_API_URL ?? ""
  return `${base}${chemin}`
}
