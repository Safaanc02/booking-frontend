import { useCallback, useEffect, useState } from "react"
import { proApi, publicApi } from "../../api/bookingApi"
import { heureLocale, jourLong, isoDate, prix, telephone } from "../../lib/format"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import { Champ } from "./ProDashboard"

const BADGES = {
  EN_ATTENTE:     ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMEE:      ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  HONOREE:        ["Honorée", "bg-sky-50 text-sky-700 ring-sky-200"],
  ABSENT:         ["Absent", "bg-red-50 text-red-700 ring-red-200"],
  ANNULEE_CLIENT: ["Annulée (client)", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON:  ["Annulée (salon)", "bg-stone-100 text-stone-500 ring-stone-200"],
}

const ORIGINES = { TELEPHONE: "☎ téléphone", COMPTOIR: "🏠 comptoir" }

export default function OngletAgenda({ salon }) {
  const [jour, setJour] = useState(isoDate(new Date()))
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [saisie, setSaisie] = useState(false)

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    proApi
      .agenda(salon.id, { date: jour, jours: 1 })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [salon.id, jour])

  useEffect(charger, [charger])

  const decaler = (n) => {
    const d = new Date(`${jour}T12:00:00`)
    d.setDate(d.getDate() + n)
    setJour(isoDate(d))
  }

  const marquer = (id, statut) => {
    proApi.changerStatut(id, statut).then(charger).catch(() => charger())
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => decaler(-1)} aria-label="Jour précédent"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">←</button>
          <button onClick={() => setJour(isoDate(new Date()))}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Aujourd'hui</button>
          <button onClick={() => decaler(1)} aria-label="Jour suivant"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">→</button>
          <span className="ml-2 font-medium text-stone-800">{jourLong(jour)}</span>
        </div>
        <button
          onClick={() => setSaisie(!saisie)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {saisie ? "Fermer" : "Rendez-vous par téléphone"}
        </button>
      </div>

      {saisie && (
        <SaisieTelephone
          salon={salon}
          jour={jour}
          onEnregistre={() => { setSaisie(false); charger() }}
        />
      )}

      <div className="mt-5">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}
        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre="Aucun rendez-vous ce jour-là">
              Les réservations en ligne apparaîtront ici automatiquement.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((r) => {
                const [libelle, classes] = BADGES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
                const modifiable = r.statut === "CONFIRMEE" || r.statut === "EN_ATTENTE"
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-4 p-4">
                    <div className="w-16 shrink-0">
                      <p className="font-semibold text-stone-900">{heureLocale(r.debut)}</p>
                      <p className="text-xs text-stone-400">{heureLocale(r.fin)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {r.client}
                        {r.origine !== "EN_LIGNE" && (
                          <span className="ml-2 text-xs font-normal text-stone-400">{ORIGINES[r.origine]}</span>
                        )}
                      </p>
                      <p className="text-sm text-stone-600">{r.prestation} · {r.employe}</p>
                      {r.clientTelephone && (
                        <p className="text-sm text-stone-400">{telephone(r.clientTelephone)}</p>
                      )}
                      {r.noteClient && <p className="mt-1 text-xs italic text-stone-400">« {r.noteClient} »</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>{libelle}</span>
                      <span className="text-sm font-semibold text-stone-900">{prix(r.prix)}</span>
                      {modifiable && (
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => marquer(r.id, "HONOREE")} className="text-emerald-700 underline">Honorée</button>
                          <button onClick={() => marquer(r.id, "ABSENT")} className="text-red-700 underline">Absent</button>
                          <button onClick={() => marquer(r.id, "ANNULEE_SALON")} className="text-stone-500 underline">Annuler</button>
                        </div>
                      )}
                    </div>
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

/**
 * Saisie d'un rendez-vous pris au téléphone.
 *
 * Indispensable : sans elle le salon tient deux agendas — le nôtre et son
 * carnet — et les créneaux pris par téléphone restent proposés en ligne.
 */
function SaisieTelephone({ salon, jour, onEnregistre }) {
  const prestations = salon.prestations ?? []
  const [form, setForm] = useState({
    prestationId: prestations[0]?.id ?? "",
    employeId: "",
    heure: "",
    clientNom: "",
    clientTelephone: "",
    note: "",
  })
  const [employes, setEmployes] = useState([])
  const [creneaux, setCreneaux] = useState([])
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const maj = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (!form.prestationId) return
    publicApi.employesPour(salon.id, form.prestationId).then(setEmployes).catch(() => setEmployes([]))
  }, [salon.id, form.prestationId])

  useEffect(() => {
    if (!form.prestationId || !form.employeId) { setCreneaux([]); return }
    publicApi
      .disponibilites(salon.id, { prestationId: form.prestationId, date: jour, employeId: form.employeId })
      .then((d) => setCreneaux(d.creneaux ?? []))
      .catch(() => setCreneaux([]))
  }, [salon.id, form.prestationId, form.employeId, jour])

  const soumettre = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    proApi
      .creerReservation(salon.id, {
        prestationId: Number(form.prestationId),
        employeId: Number(form.employeId),
        debut: form.heure,
        clientNom: form.clientNom,
        clientTelephone: form.clientTelephone || null,
        note: form.note || null,
        origine: "TELEPHONE",
      })
      .then(onEnregistre)
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const champs = envoi.erreur?.details ?? {}

  return (
    <form onSubmit={soumettre} className="mt-4 rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
      <p className="text-sm font-medium text-stone-800">Rendez-vous du {jourLong(jour)}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-stone-600">Prestation</span>
          <select value={form.prestationId} onChange={maj("prestationId")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            {prestations.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-stone-600">Praticien</span>
          <select value={form.employeId} onChange={maj("employeId")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            <option value="">Choisir…</option>
            {employes.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm text-stone-600">
            Créneau {creneaux.length === 0 && form.employeId && "— aucun disponible ce jour-là"}
          </span>
          <select value={form.heure} onChange={maj("heure")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            <option value="">Choisir…</option>
            {creneaux.map((c) => (
              <option key={c.debut} value={c.debut}>{heureLocale(c.debut)}</option>
            ))}
          </select>
        </label>

        <Champ label="Nom du client" value={form.clientNom} onChange={maj("clientNom")}
               erreur={champs.clientNom} required />
        <Champ label="Téléphone" value={form.clientTelephone} onChange={maj("clientTelephone")}
               erreur={champs.clientTelephone} placeholder="0612345678" />
        <Champ label="Note" value={form.note} onChange={maj("note")} className="sm:col-span-2" />
      </div>

      {envoi.erreur && !envoi.erreur.details && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {envoi.erreur.message}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi.enCours || !form.heure || !form.employeId}
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
      >
        {envoi.enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  )
}
