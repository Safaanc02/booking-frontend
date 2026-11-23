import { useCallback, useEffect, useState } from "react"
import { proApi } from "../../api/bookingApi"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import { prix, instantLong, telephone as formatTel } from "../../lib/format"

/**
 * Les clients du salon.
 *
 * Tout est calculé depuis les réservations : rien n'est tenu à jour en
 * parallèle, donc rien ne peut dériver. Un compteur de visites faux serait
 * pire qu'absent — c'est dessus qu'on s'appuie pour reconnaître un habitué.
 *
 * Un client, ici, c'est un numéro de téléphone. C'est ainsi que le carnet
 * papier fonctionne, et c'est la seule donnée commune aux deux origines de
 * réservation : en ligne le client a un compte, au téléphone le salon saisit
 * un nom et un numéro. Se fier au compte couperait en deux la personne qui
 * appelle un jour et réserve en ligne le lendemain.
 */

const BADGES = {
  HONOREE: ["Honoré", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  CONFIRMEE: ["À venir", "bg-sky-50 text-sky-700 ring-sky-200"],
  EN_ATTENTE: ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  ANNULEE_CLIENT: ["Annulé", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON: ["Annulé par vous", "bg-stone-100 text-stone-500 ring-stone-200"],
  ABSENT: ["Absent", "bg-red-50 text-red-700 ring-red-200"],
}

export default function OngletClients({ salon }) {
  const [q, setQ] = useState("")
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [ouverte, setOuverte] = useState(null)

  const charger = useCallback(() => {
    setEtat((e) => ({ ...e, statut: e.data.length ? "ok" : "chargement" }))
    proApi
      .clients(salon.id, q)
      .then((data) => setEtat({ statut: "ok", data: data ?? [], erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [salon.id, q])

  // La recherche attend que la frappe s'arrête : une requête par lettre
  // ferait travailler le serveur pour des résultats que personne ne lit.
  useEffect(() => {
    const t = setTimeout(charger, q ? 350 : 0)
    return () => clearTimeout(t)
  }, [charger, q])

  if (ouverte) {
    return <Fiche salon={salon} cle={ouverte} onFermer={() => { setOuverte(null); charger() }} />
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Chercher un nom ou un numéro…"
        aria-label="Chercher un client"
        className="w-full max-w-sm rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400"
      />

      <div className="mt-5">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre={q ? "Aucun client ne correspond" : "Aucun client pour le moment"}>
              {q
                ? "Essayez un autre nom, ou une partie du numéro."
                : "Les fiches se remplissent d’elles-mêmes, au fil des rendez-vous."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((c) => (
                <li key={c.cle}>
                  <button
                    onClick={() => setOuverte(c.cle)}
                    className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2.5 font-medium text-stone-900">
                        {c.nom ?? "Client sans nom"}
                        {c.note && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                            Note
                          </span>
                        )}
                        {/* Trois absences font un habitué qu'on rappelle la
                            veille ; en dessous, c'est de la malchance. */}
                        {c.absences >= 3 && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                            {c.absences} absences
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {c.telephone ? formatTel(c.telephone) : "Sans numéro"}
                        {c.derniereVisite && (
                          <span className="text-stone-400"> · vu le {instantLong(c.derniereVisite)}</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-stone-900">
                        {c.visites} visite{c.visites > 1 ? "s" : ""}
                      </p>
                      <p className="text-sm tabular-nums text-stone-500">{prix(c.totalDepense)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

/** Une fiche : l'historique complet, et la note du salon. */
function Fiche({ salon, cle, onFermer }) {
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })
  const [note, setNote] = useState("")
  const [enregistrement, setEnregistrement] = useState({ enCours: false, ok: false })
  const [tout, setTout] = useState(false)

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    proApi
      .ficheClient(salon.id, cle)
      .then((data) => { setEtat({ statut: "ok", data, erreur: null }); setNote(data.note ?? "") })
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [salon.id, cle])

  useEffect(charger, [charger])

  const enregistrerNote = () => {
    setEnregistrement({ enCours: true, ok: false })
    proApi.noterClient(salon.id, cle, note)
      .then(() => setEnregistrement({ enCours: false, ok: true }))
      .catch(() => setEnregistrement({ enCours: false, ok: false }))
  }

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  const c = etat.data

  return (
    <div>
      <button
        onClick={onFermer}
        className="text-sm text-stone-500 transition hover:text-stone-800"
      >
        ← Tous les clients
      </button>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-xl font-bold text-stone-900">{c.nom ?? "Client sans nom"}</h2>
        {c.telephone && (
          <a href={`tel:${c.telephone}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
            {formatTel(c.telephone)}
          </a>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Visites", c.visites],
          ["Annulations", c.annulations],
          ["Absences", c.absences],
          ["Total", prix(c.totalDepense)],
        ].map(([libelle, valeur]) => (
          <div key={libelle} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
            <dt className="text-xs uppercase tracking-wide text-stone-400">{libelle}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{valeur}</dd>
          </div>
        ))}
      </dl>

      {c.premiereVisite && (
        <p className="mt-3 text-sm text-stone-500">
          Cliente depuis le {instantLong(c.premiereVisite)}.
        </p>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <h3 className="font-semibold text-stone-900">Votre note</h3>
        <p className="mt-1 text-sm text-stone-500">
          Visible par vous seul. Aucun autre salon ne la lit, et le client non plus.
        </p>
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setEnregistrement({ enCours: false, ok: false }) }}
          rows={3}
          placeholder="Préfère Sofia · allergique à l’ammoniaque · toujours en retard…"
          className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            onClick={enregistrerNote}
            disabled={enregistrement.enCours}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {enregistrement.enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          {enregistrement.ok && (
            <p role="status" className="text-sm font-medium text-emerald-700">Note enregistrée.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-semibold text-stone-900">Historique</h3>
        {/*
          Les dix derniers, puis tout sur demande.

          Une cliente fidèle depuis deux ans a cinquante lignes, et la fiche
          devenait un mur de cinq mille pixels où l'on ne retrouvait plus ni
          les compteurs ni la note — c'est-à-dire tout ce qu'on venait
          chercher. Les dernières visites répondent à la question courante :
          « elle est venue quand, avec qui, pour quoi ? »
        */}
        <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          {(tout ? c.historique : c.historique?.slice(0, 10))?.map((r) => {
            const [libelle, classes] = BADGES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{r.prestation}</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {instantLong(r.debut)}
                    {r.employe && <span className="text-stone-400"> · avec {r.employe}</span>}
                    {r.origine === "TELEPHONE" && <span className="text-stone-400"> · par téléphone</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-stone-600">{prix(r.prix)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${classes}`}>
                    {libelle}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        {c.historique?.length > 10 && (
          <button
            onClick={() => setTout((v) => !v)}
            className="mt-3 text-sm font-medium text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
          >
            {tout
              ? "Ne montrer que les dix derniers"
              : `Voir les ${c.historique.length} rendez-vous`}
          </button>
        )}
      </section>
    </div>
  )
}
