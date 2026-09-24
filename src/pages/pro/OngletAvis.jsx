import { useCallback, useEffect, useState } from "react"
import { publicApi, avisApi } from "../../api/bookingApi"
import Etoiles, { NoteResume } from "../../components/Etoiles"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"

const dateCourte = (iso) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" })
        .format(new Date(iso))
    : ""

export default function OngletAvis({ salon }) {
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })
  const [reponses, setReponses] = useState({})
  const [envoi, setEnvoi] = useState({ id: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .avis(salon.id, { size: 50 })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [salon.id])

  useEffect(charger, [charger])

  const repondre = (avisId) => {
    const texte = (reponses[avisId] ?? "").trim()
    if (!texte) return
    setEnvoi({ id: avisId, erreur: null })
    avisApi
      .repondre(avisId, texte)
      .then(() => { setEnvoi({ id: null, erreur: null }); setReponses({ ...reponses, [avisId]: "" }); charger() })
      .catch((erreur) => setEnvoi({ id: null, erreur }))
  }

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  const avis = etat.data.content ?? []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-stone-900">Avis clients</h2>
        <NoteResume moyenne={salon.noteMoyenne} nombre={salon.nombreAvis} />
      </div>

      {envoi.erreur && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {envoi.erreur.message}
        </p>
      )}

      <div className="mt-5">
        {avis.length === 0 ? (
          <EmptyState titre="Aucun avis pour l'instant">
            Ils arriveront à mesure que vous marquerez des rendez-vous comme honorés.
          </EmptyState>
        ) : (
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
                  {a.prestation}{a.employe && ` · avec ${a.employe}`}
                </p>
                {a.commentaire && <p className="mt-3 text-stone-700">{a.commentaire}</p>}

                {a.reponseSalon ? (
                  <div className="mt-4 rounded-xl bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Votre réponse</p>
                    <p className="mt-1 text-sm text-stone-700">{a.reponseSalon}</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    {/* Répondre posément à un avis mitigé laisse souvent une
                        meilleure impression que l'avis lui-même. */}
                    <textarea
                      value={reponses[a.id] ?? ""}
                      onChange={(e) => setReponses({ ...reponses, [a.id]: e.target.value })}
                      maxLength={1000}
                      rows={2}
                      placeholder="Répondre publiquement…"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                    <button
                      onClick={() => repondre(a.id)}
                      disabled={envoi.id === a.id || !(reponses[a.id] ?? "").trim()}
                      className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
                    >
                      {envoi.id === a.id ? "Envoi…" : "Publier ma réponse"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
