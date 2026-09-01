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

/** Affiche un numéro marocain par paires : 06 12 34 56 78. */
export const telephone = (numero) => {
  if (!numero) return ""
  const national = numero.replace(/^\+212/, "0").replace(/\s/g, "")
  return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
}
