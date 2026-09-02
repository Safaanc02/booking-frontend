import { useEffect, useState, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { reservationsApi, avisApi } from "../api/bookingApi"
import { useAuth } from "../auth/useAuth"
import { prix, instantLong } from "../lib/format"
import Loader, { EmptyState, ErrorState } from "../components/Loader"
import Etoiles from "../components/Etoiles"

const BADGES = {
  EN_ATTENTE:     ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMEE:      ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  ANNULEE_CLIENT: ["Annulée", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON:  ["Annulée par le salon", "bg-stone-100 text-stone-500 ring-stone-200"],
  HONOREE:        ["Honorée", "bg-sky-50 text-sky-700 ring-sky-200"],
  ABSENT:         ["Absence", "bg-red-50 text-red-700 ring-red-200"],
}

const ACTIVE = new Set(["EN_ATTENTE", "CONFIRMEE"])

export default function Account() {
  const { authenticated, ready, login, user } = useAuth()
  const [params] = useSearchParams()
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [action, setAction] = useState({ id: null, erreur: null })

  const charger = useCallback(() => {
    if (!authenticated) return
    setEtat({ statut: "chargement", data: [], erreur: null })
    reservationsApi
      .mesReservations()
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [authenticated])

  useEffect(charger, [charger])

  const annuler = (id) => {
    setAction({ id, erreur: null })
    reservationsApi
      .annuler(id)
      .then(() => { setAction({ id: null, erreur: null }); charger() })
      .catch((erreur) => setAction({ id: null, erreur }))
  }

  if (!ready) return <Loader />

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Connectez-vous</h1>
        <p className="mt-2 text-sm text-stone-600">Vos réservations s'affichent ici une fois connecté.</p>
        <button
          onClick={login}
          className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Se connecter
        </button>
      </div>
    )
  }

  const maintenant = Date.now()
  const aVenir = etat.data.filter((r) => ACTIVE.has(r.statut) && new Date(r.debut) >= maintenant)
  const passees = etat.data.filter((r) => !aVenir.includes(r))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900">Mes réservations</h1>
      <p className="mt-1 text-sm text-stone-500">{user?.email}</p>

      {params.get("reservation") === "ok" && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Votre réservation est confirmée. À bientôt !
        </p>
      )}
      {action.erreur && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {action.erreur.message}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && etat.data.length === 0 && (
          <EmptyState titre="Aucune réservation pour le moment">
            <Link to="/recherche" className="text-brand-700 underline">Trouvez un salon</Link> pour commencer.
          </EmptyState>
        )}

        {etat.statut === "ok" && aVenir.length > 0 && (
          <Section titre="À venir" liste={aVenir} onAnnuler={annuler} enCours={action.id} annulable />
        )}
        {etat.statut === "ok" && passees.length > 0 && (
          <Section titre="Historique" liste={passees} onAvis={charger} />
        )}
      </div>
    </div>
  )
}

function Section({ titre, liste, onAnnuler, enCours, annulable = false, onAvis }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">{titre}</h2>
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        {liste.map((r) => {
          const [libelle, classes] = BADGES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
          return (
            <li
              key={r.id}
              // data-reservation-id : point d'accroche stable pour les scripts
              // de vérification. Deux réservations peuvent partager le même
              // jour et la même heure : un repérage par texte est ambigu.
              data-reservation-id={r.id}
              className="flex flex-wrap items-start justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="font-medium text-stone-900">{r.prestation}</p>
                <p className="mt-0.5 text-sm text-stone-600">
                  <Link to={`/salon/${r.salonId}`} className="hover:underline">{r.salonNom}</Link>
                  {r.employe && <span className="text-stone-400"> · avec {r.employe}</span>}
                </p>
                <p className="mt-1 text-sm text-stone-500">{instantLong(r.debut)}</p>
                {r.noteClient && <p className="mt-1 text-xs italic text-stone-400">« {r.noteClient} »</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>
                  {libelle}
                </span>
                <span className="text-sm font-semibold text-stone-900">{prix(r.prix)}</span>
                {/* Le bouton n'apparaît que si le serveur dit l'annulation
                    encore possible. L'afficher puis répondre 409 est une
                    promesse qu'on ne tient pas. */}
                {annulable && (
                  r.annulable ? (
                    <button
                      onClick={() => onAnnuler(r.id)}
                      disabled={enCours === r.id}
                      className="text-xs text-stone-500 underline hover:text-red-700 disabled:opacity-50"
                    >
                      {enCours === r.id ? "Annulation…" : "Annuler"}
                    </button>
                  ) : (
                    <span className="text-right text-xs text-stone-400">
                      Annulation close
                      <br />
                      ({r.delaiAnnulationHeures} h de préavis)
                    </span>
                  )
                )}
              </div>
              {/* Le dépôt d'un avis n'est proposé qu'après un rendez-vous
                  effectivement honoré, et une seule fois. */}
              {r.statut === "HONOREE" && (
                <div className="w-full">
                  {r.avisDepose
                    ? <p className="text-xs text-stone-400">Merci, votre avis a bien été enregistré.</p>
                    : <FormulaireAvis reservationId={r.id} onDepose={onAvis} />}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Dépôt d'un avis, replié tant que le client ne l'a pas demandé. */
function FormulaireAvis({ reservationId, onDepose }) {
  const [ouvert, setOuvert] = useState(false)
  const [note, setNote] = useState(0)
  const [commentaire, setCommentaire] = useState("")
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
      >
        Donner mon avis
      </button>
    )
  }

  const soumettre = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    avisApi
      .deposer({ reservationId, note, commentaire: commentaire.trim() || null })
      .then(() => { setOuvert(false); onDepose?.() })
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  return (
    <form onSubmit={soumettre} className="mt-3 rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600">Votre note</span>
        <Etoiles note={note} taille="md" onChange={setNote} name={`note-${reservationId}`} />
      </div>
      <textarea
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Ce qui vous a plu, ou moins plu…"
        className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      {envoi.erreur && <p className="mt-2 text-xs text-red-700">{envoi.erreur.message}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={envoi.enCours || note === 0}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
        >
          {envoi.enCours ? "Envoi…" : "Publier"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="text-xs text-stone-500 hover:text-stone-800">
          Annuler
        </button>
      </div>
    </form>
  )
}
