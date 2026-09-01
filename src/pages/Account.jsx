import { useEffect, useState, useCallback } from "react"
import { reservationsApi } from "../api/bookingApi"
import { useAuth } from "../auth/useAuth"
import Loader, { EmptyState, ErrorState } from "../components/Loader"

const LIBELLES = {
  PENDING: ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMED: ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  CANCELLED: ["Annulée", "bg-stone-100 text-stone-500 ring-stone-200"],
}

export default function Account() {
  const { authenticated, ready, login, user } = useAuth()
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })

  const charger = useCallback(() => {
    if (!authenticated) return
    setEtat({ statut: "chargement", data: [], erreur: null })
    reservationsApi
      .mesReservations()
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [authenticated])

  useEffect(charger, [charger])

  if (!ready) return <Loader />

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Connectez-vous</h1>
        <p className="mt-2 text-sm text-stone-600">
          Vos réservations s'affichent ici une fois connecté.
        </p>
        <button
          onClick={login}
          className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Se connecter
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900">Mes réservations</h1>
      <p className="mt-1 text-sm text-stone-500">{user?.email}</p>

      <div className="mt-6">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}
        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre="Aucune réservation pour le moment">
              Vos rendez-vous à venir apparaîtront ici.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((r) => {
                const [libelle, classes] = LIBELLES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
                return (
                  <li key={r.id} className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-medium text-stone-900">Réservation n°{r.id}</p>
                      <p className="mt-0.5 text-sm text-stone-500">Créneau {r.creneauId}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>
                      {libelle}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
