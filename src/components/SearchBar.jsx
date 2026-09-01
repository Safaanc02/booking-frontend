import { useState } from "react"
import { useNavigate } from "react-router-dom"

const VILLES = [
  "Casablanca", "Rabat", "Marrakech", "Tanger", "Fès",
  "Agadir", "Meknès", "Oujda", "Tétouan", "Kénitra",
]

export default function SearchBar({ valeursInitiales = {}, compact = false }) {
  const navigate = useNavigate()
  const [q, setQ] = useState(valeursInitiales.q ?? "")
  const [ville, setVille] = useState(valeursInitiales.ville ?? "")

  const soumettre = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (ville) params.set("ville", ville)
    navigate(`/recherche?${params}`)
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
        {VILLES.map((v) => (
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
