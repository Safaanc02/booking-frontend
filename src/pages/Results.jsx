import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import { ErrorState } from "../components/Loader"
import { EtoileHuit } from "../components/Motifs"
import {
  Coiffure, Barbier, Onglerie, Esthetique, Hammam,
} from "../components/Glyphes"

const METIERS = [
  { cle: "COIFFURE", libelle: "Coiffure" },
  { cle: "BARBIER", libelle: "Barbier" },
  { cle: "ONGLERIE", libelle: "Onglerie" },
  { cle: "ESTHETIQUE", libelle: "Esthétique" },
  { cle: "SPA", libelle: "Hammam & spa" },
]
const GLYPHES = {
  COIFFURE: Coiffure, BARBIER: Barbier, ONGLERIE: Onglerie,
  ESTHETIQUE: Esthetique, SPA: Hammam,
}

/**
 * Squelettes de chargement, à la place d'un rouet.
 *
 * Un rouet centré sur une page vide ne dit rien de ce qui arrive. Des cadres
 * à la forme des cartes annoncent la mise en page, et l'attente paraît plus
 * courte parce qu'on sait déjà où regarder.
 */
function Squelettes() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
          <div className="h-28 animate-pulse bg-stone-200/70" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
            <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Résultats de recherche.
 *
 * Le filtre par métier est côté client, sur la page reçue. C'est assumé au
 * volume actuel — une vingtaine de salons — et l'écran reste réactif sans
 * aller-retour. Au-delà d'une page, il faudra le porter dans la requête,
 * faute de quoi il ne filtrerait que ce qui est déjà affiché.
 */
export default function Results() {
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const ville = params.get("ville") ?? ""
  const metier = params.get("metier") ?? ""

  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .rechercherSalons({ q, ville })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [q, ville])

  useEffect(charger, [charger])

  const recus = etat.data?.content ?? []
  const salons = metier ? recus.filter((s) => s.categorie === metier) : recus
  const presents = new Set(recus.map((s) => s.categorie))

  const basculerMetier = (cle) => {
    const suivant = new URLSearchParams(params)
    if (cle === metier) suivant.delete("metier")
    else suivant.set("metier", cle)
    setParams(suivant, { replace: true })
  }

  return (
    <div>
      {/* La barre de recherche sur un fond teinté : elle se détache de la
          liste au lieu de flotter dans le même blanc que les cartes. */}
      <div className="relative overflow-hidden border-b border-stone-200/70 bg-gradient-to-b from-brand-50/70 to-ivoire">
        <div className="relative mx-auto max-w-6xl px-4 py-7">
          <SearchBar valeursInitiales={{ q, ville }} variante="hero" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {etat.statut === "chargement" && <Squelettes />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
              <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-stone-900">
                <EtoileHuit className="h-3 w-3 shrink-0 text-brand-500" />
                {salons.length === 0
                  ? "Aucun salon"
                  : `${salons.length} salon${salons.length > 1 ? "s" : ""}`}
                {ville && <span className="font-normal text-stone-500">à {ville}</span>}
              </h1>

              {/* Seuls les métiers réellement présents sont proposés : un
                  filtre qui ne rend rien est une impasse offerte au visiteur. */}
              {presents.size > 1 && (
                <div className="flex flex-wrap gap-2">
                  {METIERS.filter((m) => presents.has(m.cle)).map((m) => {
                    const Glyphe = GLYPHES[m.cle]
                    const actif = metier === m.cle
                    return (
                      <button
                        key={m.cle}
                        onClick={() => basculerMetier(m.cle)}
                        aria-pressed={actif}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${
                          actif
                            ? "border-brand-600 bg-brand-600 font-medium text-white"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        <Glyphe className="h-4 w-4" />
                        {m.libelle}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {salons.length === 0 ? (
              <div className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200/70">
                <div className="p-10 text-center">
                  <EtoileHuit className="mx-auto h-7 w-7 text-brand-200" />
                  <h2 className="mt-4 text-xl font-semibold text-stone-900">
                    Rien ne correspond{metier ? " à ce métier" : ""}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">
                    {metier
                      ? "Retirez le filtre de métier, ou essayez une autre ville."
                      : "Essayez une autre ville, ou des mots-clés plus larges. Le réseau s’étend salon par salon."}
                  </p>
                  {metier && (
                    <button
                      onClick={() => basculerMetier(metier)}
                      className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Voir les {recus.length} salons
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {salons.map((s) => (
                  <SalonCard key={s.id} salon={s} villeFiltree={Boolean(ville)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
