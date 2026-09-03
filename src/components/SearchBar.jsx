import { useState } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Villes de repli.
 *
 * Servent quand l'appel qui remonte les villes réellement couvertes n'a pas
 * abouti. Proposer une ville sans salon mène à une page vide : la liste
 * fournie par le serveur est donc toujours préférée.
 */
const VILLES_DEFAUT = [
  "Casablanca", "Rabat", "Marrakech", "Tanger", "Fès",
  "Agadir", "Meknès", "Oujda", "Tétouan", "Kénitra",
]

export default function SearchBar({
  valeursInitiales = {},
  compact = false,
  villes,
  /** « hero » étiquette les deux champs et gagne en hauteur. */
  variante = "normal",
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState(valeursInitiales.q ?? "")
  const [ville, setVille] = useState(valeursInitiales.ville ?? "")
  const choix = villes?.length ? villes : VILLES_DEFAUT
  const hero = variante === "hero"

  const soumettre = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (ville) params.set("ville", ville)
    navigate(`/recherche?${params}`)
  }

  if (hero) {
    return (
      <form
        onSubmit={soumettre}
        className="flex w-full flex-col gap-1 rounded-2xl bg-white p-2 shadow-lg shadow-brand-900/5 ring-1 ring-stone-200/80 sm:flex-row sm:items-stretch sm:gap-0 sm:p-2.5"
      >
        <label className="min-w-0 flex-1 rounded-xl px-4 py-2.5 transition focus-within:bg-stone-50">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Que cherchez-vous ?
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Coiffeur, barbier, hammam…"
            className="mt-0.5 w-full bg-transparent text-[15px] outline-none placeholder:text-stone-400"
          />
        </label>

        <div className="mx-1 hidden w-px self-center bg-stone-200 sm:block sm:h-9" />

        <label className="rounded-xl px-4 py-2.5 transition focus-within:bg-stone-50 sm:w-52">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Où ?
          </span>
          <select
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="mt-0.5 w-full bg-transparent text-[15px] outline-none"
          >
            <option value="">Toutes les villes</option>
            {choix.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:ml-1"
        >
          Rechercher
        </button>
      </form>
    )
  }

  return (
    <form
      onSubmit={soumettre}
      className={`flex w-full flex-col gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-stone-200 sm:flex-row ${
        compact ? "" : "sm:p-3"
      }`}
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Salon, coiffeur, barbier…"
        aria-label="Que cherchez-vous ?"
        className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:bg-stone-50"
      />
      <div className="hidden w-px self-stretch bg-stone-200 sm:block" />
      <select
        value={ville}
        onChange={(e) => setVille(e.target.value)}
        aria-label="Ville"
        className="rounded-xl px-4 py-3 text-sm outline-none focus:bg-stone-50 sm:w-48"
      >
        <option value="">Toutes les villes</option>
        {choix.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Rechercher
      </button>
    </form>
  )
}
