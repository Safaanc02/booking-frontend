import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import { Boussole } from "./Glyphes"
import { localiser } from "../lib/geolocalisation"

/**
 * Villes de repli.
 *
 * Servent uniquement quand l'appel qui remonte les villes réellement
 * couvertes n'a pas abouti. Proposer une ville sans salon mène à une page vide
 * sans que rien ne l'explique — la liste du serveur est donc toujours
 * préférée, et ce repli n'est qu'un filet.
 *
 * Il a longtemps servi bien plus que cela : seule la page d'accueil passait la
 * vraie liste, si bien que la barre des résultats proposait ces dix villes
 * quand le réseau n'en couvrait que quatre. Six choix menaient à coup sûr
 * nulle part. La barre va maintenant chercher la liste elle-même.
 */
const VILLES_DEFAUT = [
  "Casablanca", "Rabat", "Marrakech", "Tanger", "Fès",
  "Agadir", "Meknès", "Oujda", "Tétouan", "Kénitra",
]

/** Rayon de départ d'une recherche par proximité, en kilomètres. */
const RAYON_DEFAUT = 25

export default function SearchBar({
  valeursInitiales = {},
  compact = false,
  villes,
  /** « hero » étiquette les deux champs et gagne en hauteur. */
  variante = "normal",
  /** Vrai quand la recherche en cours est déjà classée par distance. */
  situee = false,
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState(valeursInitiales.q ?? "")
  const [ville, setVille] = useState(valeursInitiales.ville ?? "")
  const [localisation, setLocalisation] = useState({ etat: "repos", message: null })
  /*
   * Les villes couvertes, demandées au serveur si l'appelant ne les fournit
   * pas. La réponse est mise en cache dix minutes côté serveur : la barre peut
   * donc s'afficher sur toutes les pages sans que cela coûte un appel à
   * chaque fois.
   */
  const [villesServeur, setVillesServeur] = useState(null)
  useEffect(() => {
    if (villes?.length) return
    let vivant = true
    publicApi.villes()
      .then((liste) => { if (vivant && liste?.length) setVillesServeur(liste) })
      // Repli silencieux sur la liste écrite en dur : une barre de recherche
      // sans liste de villes serait pire qu'une liste imparfaite.
      .catch(() => {})
    return () => { vivant = false }
  }, [villes])

  const choix = villes?.length ? villes : (villesServeur ?? VILLES_DEFAUT)
  const hero = variante === "hero"

  const soumettre = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (ville) params.set("ville", ville)
    navigate(`/recherche?${params}`)
  }

  /**
   * Classe les résultats par distance depuis la position du navigateur.
   *
   * La ville est retirée de la recherche : choisir « Casablanca » puis
   * « autour de moi » demanderait les salons casablancais les plus proches
   * d'un point à Rabat, et rendrait une page vide sans que rien ne l'explique.
   * Le mot-clé, lui, reste — « barbier autour de moi » a un sens.
   *
   * Le libellé du bouton passe à « Localisation… » et le bouton se désactive :
   * la permission du navigateur peut prendre plusieurs secondes, et sans
   * retour on le clique deux fois.
   */
  const autourDeMoi = async () => {
    setLocalisation({ etat: "attente", message: null })
    try {
      const { lat, lng } = await localiser()
      const params = new URLSearchParams()
      if (q.trim()) params.set("q", q.trim())
      params.set("lat", lat)
      params.set("lng", lng)
      params.set("rayon", RAYON_DEFAUT)
      setVille("")
      setLocalisation({ etat: "repos", message: null })
      navigate(`/recherche?${params}`)
    } catch (erreur) {
      setLocalisation({ etat: "erreur", message: erreur.message })
    }
  }

  const attente = localisation.etat === "attente"

  /**
   * Le bouton de proximité, sous la barre plutôt que dedans.
   *
   * Dedans, il aurait fallu lui trouver une place entre « Où ? » et
   * « Rechercher », où il aurait ressemblé à un troisième champ à remplir. Il
   * ne se remplit pas : il remplace le choix d'une ville d'un seul geste. En
   * dessous, aligné sur le premier champ, il se lit comme le raccourci qu'il est.
   */
  const boutonProximite = (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <button
        type="button"
        onClick={autourDeMoi}
        disabled={attente}
        aria-live="polite"
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-70 ${
          situee
            ? "bg-brand-600 text-white ring-1 ring-brand-600 hover:bg-brand-700"
            : "bg-white text-brand-700 ring-1 ring-stone-200 hover:ring-brand-300 hover:text-brand-800"
        }`}
      >
        <Boussole className={`h-4 w-4 ${attente ? "animate-spin" : ""}`} />
        {attente ? "Localisation…" : situee ? "Autour de moi" : "Salons autour de moi"}
      </button>

      {localisation.etat === "erreur" && (
        <p role="alert" className="max-w-md text-xs text-stone-600">
          {localisation.message}
        </p>
      )}
    </div>
  )

  if (hero) {
    return (
      <div className="w-full">
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
        {boutonProximite}
      </div>
    )
  }

  return (
    <div className="w-full">
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
      {boutonProximite}
    </div>
  )
}
