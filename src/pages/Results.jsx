import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import Loader, { EmptyState, ErrorState } from "../components/Loader"

export default function Results() {
  const [params] = useSearchParams()
  const q = params.get("q") ?? ""
  const ville = params.get("ville") ?? ""

  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .rechercherSalons({ q, ville })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [q, ville])

  useEffect(charger, [charger])

  const salons = etat.data?.content ?? []
  const total = etat.data?.totalElements ?? 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SearchBar valeursInitiales={{ q, ville }} compact />

      <div className="mt-8">
        {etat.statut === "chargement" && <Loader label="Recherche des salons…" />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          <>
            <p className="mb-4 text-sm text-stone-500">
              {total === 0
                ? "Aucun salon trouvé"
                : `${total} salon${total > 1 ? "s" : ""}${ville ? ` à ${ville}` : ""}`}
            </p>

            {total === 0 ? (
              <EmptyState titre="Aucun salon ne correspond à votre recherche">
                Essayez une autre ville, ou élargissez les mots-clés.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {salons.map((s) => <SalonCard key={s.id} salon={s} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
