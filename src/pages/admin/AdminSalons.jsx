import { useCallback, useEffect, useState } from "react"
import { adminApi } from "../../api/bookingApi"
import { telephone } from "../../lib/format"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import ReferencerSalon from "./ReferencerSalon"

const ONGLETS = [
  ["REFERENCER", "Référencer"],
  ["EN_ATTENTE", "À valider"],
  ["ACTIF", "En ligne"],
  ["SUSPENDU", "Suspendus"],
]

/**
 * Référencement et validation des salons.
 *
 * Le premier onglet est l'entrée du métier : c'est l'équipe qui installe le
 * salon, pas le professionnel qui s'inscrit. Les suivants sont la file de
 * validation, sans laquelle un salon ne devient jamais visible.
 */
export default function AdminSalons() {
  const [onglet, setOnglet] = useState("REFERENCER")
  const statut = onglet === "REFERENCER" ? null : onglet
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [action, setAction] = useState({ id: null, erreur: null })

  const charger = useCallback(() => {
    if (!statut) return
    setEtat({ statut: "chargement", data: [], erreur: null })
    adminApi
      .salons(statut)
      .then((page) => setEtat({ statut: "ok", data: page.content ?? [], erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [statut])

  useEffect(charger, [charger])

  const changer = (id, nouveau) => {
    setAction({ id, erreur: null })
    adminApi
      .changerStatut(id, nouveau)
      .then(() => { setAction({ id: null, erreur: null }); charger() })
      .catch((erreur) => setAction({ id: null, erreur }))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900">Administration des salons</h1>
      <p className="mt-1 text-sm text-stone-500">
        Un salon n'apparaît dans la recherche qu'une fois validé.
      </p>

      <nav className="mt-5 flex gap-1 border-b border-stone-200">
        {ONGLETS.map(([cle, libelle]) => (
          <button
            key={cle}
            onClick={() => setOnglet(cle)}
            className={`border-b-2 px-4 py-2.5 text-sm transition ${
              onglet === cle
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {libelle}
          </button>
        ))}
      </nav>

      {action.erreur && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {action.erreur.message}
        </p>
      )}

      <div className="mt-6">
        {!statut && <ReferencerSalon />}

        {statut && etat.statut === "chargement" && <Loader />}
        {statut && etat.statut === "erreur" && (
          <ErrorState erreur={etat.erreur} onRetry={charger} />
        )}

        {statut && etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre={statut === "EN_ATTENTE" ? "Aucun salon en attente" : "Aucun salon"} />
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{s.nom}</p>
                    <p className="mt-0.5 text-sm text-stone-600">
                      {s.adresse} · {s.ville}
                      {s.quartier && <span className="text-stone-400"> ({s.quartier})</span>}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
                      {s.categorie} · {telephone(s.telephone)}
                      {s.email && ` · ${s.email}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {statut !== "ACTIF" && (
                      <button
                        onClick={() => changer(s.id, "ACTIF")}
                        disabled={action.id === s.id}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-stone-300"
                      >
                        Valider
                      </button>
                    )}
                    {statut !== "SUSPENDU" && (
                      <button
                        onClick={() => changer(s.id, "SUSPENDU")}
                        disabled={action.id === s.id}
                        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
