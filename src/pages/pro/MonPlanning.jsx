import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { proApi } from "../../api/bookingApi"
import { heureLocale, jourLong, isoDate, telephone } from "../../lib/format"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"

const BADGES = {
  EN_ATTENTE:     ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMEE:      ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  HONOREE:        ["Honorée", "bg-sky-50 text-sky-700 ring-sky-200"],
  ABSENT:         ["Absent", "bg-red-50 text-red-700 ring-red-200"],
  ANNULEE_CLIENT: ["Annulée (client)", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON:  ["Annulée (salon)", "bg-stone-100 text-stone-500 ring-stone-200"],
}

/**
 * Planning personnel d'un membre d'équipe.
 *
 * En lecture seule, volontairement : un praticien consulte ses rendez-vous, il
 * n'administre rien. Avant cette page, la seule façon de voir son planning
 * était d'emprunter le compte du propriétaire.
 */
export default function MonPlanning() {
  const [jour, setJour] = useState(isoDate(new Date()))
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    proApi
      .monPlanning({ date: jour, jours: 1 })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [jour])

  useEffect(charger, [charger])

  const decaler = (n) => {
    const d = new Date(`${jour}T12:00:00`)
    d.setDate(d.getDate() + n)
    setJour(isoDate(d))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900">Mon planning</h1>
      <p className="mt-1 text-sm text-stone-500">
        Vos rendez-vous. Pour toute modification, adressez-vous au salon.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => decaler(-1)} aria-label="Jour précédent"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">←</button>
        <button onClick={() => setJour(isoDate(new Date()))}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Aujourd'hui</button>
        <button onClick={() => decaler(1)} aria-label="Jour suivant"
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">→</button>
        <span className="ml-2 font-medium text-stone-800">{jourLong(jour)}</span>
      </div>

      <div className="mt-5">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre="Aucun rendez-vous ce jour-là">
              Si vous gérez un salon, son agenda complet est dans{" "}
              <Link to="/pro" className="text-brand-700 underline">Mon salon</Link>.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((r) => {
                const [libelle, classes] = BADGES[r.statut]
                  ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-4 p-4">
                    <div className="w-16 shrink-0">
                      <p className="font-semibold text-stone-900">{heureLocale(r.debut)}</p>
                      <p className="text-xs text-stone-400">{heureLocale(r.fin)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">{r.client}</p>
                      <p className="text-sm text-stone-600">{r.prestation}</p>
                      {r.clientTelephone && (
                        <p className="text-sm text-stone-400">{telephone(r.clientTelephone)}</p>
                      )}
                      {r.noteClient && (
                        <p className="mt-1 text-xs italic text-stone-400">« {r.noteClient} »</p>
                      )}
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
