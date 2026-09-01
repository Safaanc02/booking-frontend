import { useCallback, useEffect, useState } from "react"
import { publicApi } from "../api/bookingApi"
import Etoiles from "./Etoiles"
import Loader, { EmptyState, ErrorState } from "./Loader"

const dateCourte = (iso) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Casablanca" })
        .format(new Date(iso))
    : ""

export default function ListeAvis({ salonId }) {
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .avis(salonId, { size: 10 })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [salonId])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader label="Chargement des avis…" />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  const avis = etat.data.content ?? []
  if (avis.length === 0) {
    return (
      <EmptyState titre="Aucun avis pour le moment">
        Les avis sont déposés par des clients ayant réellement honoré un rendez-vous.
      </EmptyState>
    )
  }

  return (
    <ul className="space-y-3">
      {avis.map((a) => (
        <li key={a.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Etoiles note={a.note} />
              <span className="font-medium text-stone-900">{a.auteur}</span>
            </div>
            <span className="text-sm text-stone-400">{dateCourte(a.creeLe)}</span>
          </div>

          <p className="mt-1 text-sm text-stone-400">
            {a.prestation}
            {a.employe && ` · avec ${a.employe}`}
          </p>

          {a.commentaire && <p className="mt-3 text-stone-700">{a.commentaire}</p>}

          {a.reponseSalon && (
            <div className="mt-4 rounded-xl bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Réponse du salon
              </p>
              <p className="mt-1 text-sm text-stone-700">{a.reponseSalon}</p>
            </div>
          )}
        </li>
      ))}
      {etat.data.totalElements > avis.length && (
        <li className="text-center text-sm text-stone-400">
          {avis.length} avis sur {etat.data.totalElements}
        </li>
      )}
    </ul>
  )
}
