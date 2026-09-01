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
