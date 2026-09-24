import { useCallback, useEffect, useState } from "react"
import { publicApi } from "../api/bookingApi"
import Etoiles from "./Etoiles"
import Loader, { EmptyState, ErrorState } from "./Loader"
import { Initiales } from "./Couverture"

const dateCourte = (iso) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Casablanca" })
        .format(new Date(iso))
    : ""

/** Combien d'avis on montre avant de proposer d'en voir plus. */
const APERCU = 3

/**
 * Avis d'un salon.
 *
 * Trois avis d'abord, le reste sur demande. La version précédente en
 * dépliait dix : sur un salon un peu établi, le catalogue et le panneau de
 * réservation se retrouvaient repoussés hors de l'écran par une colonne
 * d'avis presque identiques. Trois suffisent à établir la confiance ; qui
 * veut lire les autres le demande.
 *
 * Le résumé des notes vient en tête. Une moyenne seule ne dit pas si elle
 * vient de deux avis enthousiastes ou de vingt avis tièdes.
 */
export default function ListeAvis({ salonId }) {
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })
  const [tout, setTout] = useState(false)

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

  const tous = etat.data.content ?? []
  const avis = tout ? tous : tous.slice(0, APERCU)
  if (tous.length === 0) {
    return (
      <EmptyState titre="Aucun avis pour le moment">
        Les avis sont déposés par des clients ayant réellement honoré un rendez-vous.
      </EmptyState>
    )
  }

  /* Distribution des notes, calculée sur ce qui a été chargé. */
  const parNote = [5, 4, 3, 2, 1].map((n) => ({
    note: n, nombre: tous.filter((a) => a.note === n).length,
  }))
  const moyenne = tous.reduce((s, a) => s + a.note, 0) / tous.length

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-white p-5 shadow-carte ring-1 ring-stone-200/70">
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums text-stone-900">
            {moyenne.toFixed(1).replace(".", ",")}
          </p>
          <Etoiles note={Math.round(moyenne)} />
          <p className="mt-1 text-xs text-stone-500">
            {etat.data.totalElements} avis
          </p>
        </div>
        <dl className="min-w-[180px] flex-1 space-y-1">
          {parNote.map(({ note, nombre }) => (
            <div key={note} className="flex items-center gap-2 text-xs">
              <dt className="w-8 shrink-0 tabular-nums text-stone-500">{note} ★</dt>
              <dd className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${tous.length ? (nombre / tous.length) * 100 : 0}%` }}
                  />
                </div>
              </dd>
              <span className="w-6 shrink-0 text-right tabular-nums text-stone-400">{nombre}</span>
            </div>
          ))}
        </dl>
      </div>

    <ul className="mt-4 space-y-3">
      {avis.map((a) => (
        <li key={a.id} className="rounded-2xl bg-white p-5 shadow-carte ring-1 ring-stone-200/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Initiales prenom={a.auteur ?? "?"} nom="" taille="h-9 w-9 text-sm" />
              <div>
                <span className="font-medium text-stone-900">{a.auteur}</span>
                <div className="leading-none"><Etoiles note={a.note} /></div>
              </div>
            </div>
            <span className="text-sm text-stone-400">{dateCourte(a.creeLe)}</span>
          </div>

          <p className="mt-2 text-sm text-stone-400">
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
    </ul>

      {!tout && tous.length > APERCU && (
        <button
          onClick={() => setTout(true)}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white py-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          Lire les {tous.length - APERCU} autres avis
        </button>
      )}
      {tout && etat.data.totalElements > tous.length && (
        <p className="mt-3 text-center text-sm text-stone-400">
          {tous.length} avis sur {etat.data.totalElements}
        </p>
      )}
    </div>
  )
}
