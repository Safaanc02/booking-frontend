import { useEffect, useMemo, useState } from "react"
import { publicApi } from "../api/bookingApi"
import { jourCourt, jourLong, isoDate, heureLocale } from "../lib/format"
import Loader, { EmptyState, ErrorState } from "./Loader"

/** Nombre de jours proposés dans le sélecteur horizontal. */
const FENETRE = 14

/**
 * Sélecteur de jour puis de créneau.
 *
 * Les jours réellement ouverts sont récupérés d'abord (`prochaines-dispos`) :
 * proposer une bande de dates dont la moitié est vide fait cliquer le visiteur
 * dans le vide, et c'est là qu'il abandonne.
 */
export default function CalendarSlots({ salonId, prestationId, employeId, onChoisir }) {
  const [jours, setJours] = useState({ statut: "chargement", data: [], erreur: null })
  const [jour, setJour] = useState(null)
  const [creneaux, setCreneaux] = useState({ statut: "inactif", data: [], erreur: null })

  // Bande de dates affichée : les 14 prochains jours calendaires.
  const bande = useMemo(() => {
    const base = new Date()
    return Array.from({ length: FENETRE }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return isoDate(d)
    })
  }, [])

  useEffect(() => {
    let annule = false
    setJours({ statut: "chargement", data: [], erreur: null })
    setJour(null)
    setCreneaux({ statut: "inactif", data: [], erreur: null })

    publicApi
      .prochainesDispos(salonId, { prestationId, employeId, jours: FENETRE })
      .then((data) => {
        if (annule) return
        setJours({ statut: "ok", data, erreur: null })
        if (data.length > 0) setJour(data[0])
      })
      .catch((erreur) => !annule && setJours({ statut: "erreur", data: [], erreur }))

    return () => { annule = true }
  }, [salonId, prestationId, employeId])

  useEffect(() => {
    if (!jour) return
    let annule = false
    setCreneaux({ statut: "chargement", data: [], erreur: null })

    publicApi
      .disponibilites(salonId, { prestationId, date: jour, employeId })
      .then((d) => !annule && setCreneaux({ statut: "ok", data: d.creneaux ?? [], erreur: null }))
      .catch((erreur) => !annule && setCreneaux({ statut: "erreur", data: [], erreur }))

    return () => { annule = true }
  }, [salonId, prestationId, employeId, jour])

  if (jours.statut === "chargement") return <Loader label="Recherche des disponibilités…" />
  if (jours.statut === "erreur") return <ErrorState erreur={jours.erreur} />

  if (jours.data.length === 0) {
    return (
      <EmptyState titre="Aucune disponibilité dans les deux prochaines semaines">
        Essayez un autre praticien, ou contactez directement le salon.
      </EmptyState>
    )
  }

  const ouverts = new Set(jours.data)

  return (
    <div>
      {/* Sélecteur de jour */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {bande.map((d) => {
          const ouvert = ouverts.has(d)
          const choisi = d === jour
          return (
            <button
              key={d}
              type="button"
              disabled={!ouvert}
              onClick={() => setJour(d)}
              aria-pressed={choisi}
              className={[
                "shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition",
                choisi ? "border-brand-600 bg-brand-600 text-white" : "",
                !choisi && ouvert ? "border-stone-200 bg-white hover:border-brand-300" : "",
                !ouvert ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300 line-through" : "",
              ].join(" ")}
            >
              {jourCourt(d)}
            </button>
          )
        })}
      </div>

      {/* Créneaux du jour choisi */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-medium text-stone-700">{jour && jourLong(jour)}</p>

        {creneaux.statut === "chargement" && <Loader label="Chargement des créneaux…" />}
        {creneaux.statut === "erreur" && <ErrorState erreur={creneaux.erreur} />}

        {creneaux.statut === "ok" && (
          creneaux.data.length === 0 ? (
            <EmptyState titre="Plus de créneau ce jour-là">Choisissez une autre date.</EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {creneaux.data.map((c) => (
                <button
                  key={c.debut}
                  type="button"
                  onClick={() => onChoisir({ ...c, date: jour })}
                  className="rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-800 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  {heureLocale(c.debut)}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
