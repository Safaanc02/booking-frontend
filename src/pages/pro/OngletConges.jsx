import { useCallback, useEffect, useState } from "react"
import { proApi } from "../../api/bookingApi"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"

/**
 * Congés et fermetures exceptionnelles.
 *
 * Le modèle et les routes d'écriture existaient depuis le début ; il manquait
 * la lecture et l'écran. Un salon ne pouvait donc pas fermer une semaine : il
 * pouvait déclarer une absence, mais ni la relire, ni la corriger, ni savoir
 * ce qu'il avait saisi. Écrire sans pouvoir relire n'est pas une
 * fonctionnalité.
 *
 * Une absence vise soit le salon entier — la fermeture d'août, l'Aïd —, soit
 * un praticien. Les deux se saisissent au même endroit parce que c'est la même
 * question posée à l'agenda : qui n'est pas là, et quand.
 *
 * Les dates se saisissent au jour, pas à la minute. Un salon ferme des
 * journées entières ; demander une heure de début à qui déclare deux semaines
 * de congé, c'est demander une précision inutile et se tromper une fois sur
 * deux. La journée de fin est incluse, ce que l'écran dit explicitement.
 */

const jour = (iso) => new Date(iso).toLocaleDateString("fr-MA", {
  weekday: "short", day: "numeric", month: "long",
})

/** AAAA-MM-JJ sans passer par UTC — toISOString décalerait la date d'un jour. */
const isoJour = (d) => {
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const AUJOURD_HUI = isoJour(new Date())

export default function OngletConges({ salon }) {
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [equipe, setEquipe] = useState([])
  const [form, setForm] = useState({ cible: "salon", debut: AUJOURD_HUI, fin: AUJOURD_HUI, motif: "" })
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    Promise.all([proApi.absences(salon.id), proApi.employes(salon.id)])
      .then(([absences, membres]) => {
        setEquipe(membres ?? [])
        setEtat({ statut: "ok", data: absences ?? [], erreur: null })
      })
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [salon.id])

  useEffect(charger, [charger])

  const maj = (cle) => (e) => setForm((f) => ({ ...f, [cle]: e.target.value }))

  const ajouter = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })

    /*
     * La journée de fin est incluse.
     *
     * Le modèle borne l'absence par deux instants, fin exclue. Une fermeture
     * « du 1er au 15 » saisie telle quelle s'arrêterait donc le 15 à minuit,
     * c'est-à-dire la veille au soir : le salon rouvrirait le 15 alors qu'il
     * se croit fermé, et prendrait des rendez-vous ce jour-là.
     */
    const debut = new Date(`${form.debut}T00:00:00`)
    const finIncluse = new Date(`${form.fin}T00:00:00`)
    finIncluse.setDate(finIncluse.getDate() + 1)

    proApi
      .creerAbsence({
        salonId: form.cible === "salon" ? salon.id : null,
        employeId: form.cible === "salon" ? null : Number(form.cible),
        debut: debut.toISOString(),
        fin: finIncluse.toISOString(),
        motif: form.motif || null,
      })
      .then(() => {
        setForm({ cible: "salon", debut: AUJOURD_HUI, fin: AUJOURD_HUI, motif: "" })
        setEnvoi({ enCours: false, erreur: null })
        charger()
      })
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const supprimer = (id) => {
    proApi.supprimerAbsence(id).then(charger).catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  /** La veille de la fin enregistrée : l'inverse du décalage fait à la saisie. */
  const finAffichee = (iso) => {
    const d = new Date(iso)
    d.setDate(d.getDate() - 1)
    return d.toISOString()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={ajouter} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <h3 className="font-semibold text-stone-900">Déclarer une absence</h3>
        <p className="mt-1 text-sm text-stone-500">
          Aucun rendez-vous ne pourra être pris sur cette période. Les rendez-vous
          déjà pris ne sont pas annulés — prévenez les clients concernés.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-stone-600">Qui</span>
            <select
              value={form.cible}
              onChange={maj("cible")}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="salon">Le salon entier</option>
              {equipe.map((m) => (
                <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-stone-600">Motif (facultatif)</span>
            <input
              value={form.motif}
              onChange={maj("motif")}
              placeholder="Congé, Aïd, travaux…"
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>

          <label className="block">
            <span className="text-sm text-stone-600">Du</span>
            <input
              type="date"
              value={form.debut}
              min={AUJOURD_HUI}
              onChange={(e) => setForm((f) => ({
                ...f, debut: e.target.value,
                // Une fin antérieure au début est refusée par le serveur ; la
                // corriger ici évite un aller-retour pour rien.
                fin: f.fin < e.target.value ? e.target.value : f.fin,
              }))}
              required
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>

          <label className="block">
            <span className="text-sm text-stone-600">Au (inclus)</span>
            <input
              type="date"
              value={form.fin}
              min={form.debut}
              onChange={maj("fin")}
              required
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={envoi.enCours}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {envoi.enCours ? "Enregistrement…" : "Déclarer"}
          </button>
          {envoi.erreur && (
            <p role="alert" className="text-sm text-red-700">{envoi.erreur.message}</p>
          )}
        </div>
      </form>

      <div>
        <h3 className="font-semibold text-stone-900">À venir</h3>
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}
        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <div className="mt-3">
              <EmptyState titre="Aucune fermeture prévue">
                Le salon et son équipe sont disponibles sur leurs horaires habituels.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {etat.data.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      {a.employeNom ?? "Salon fermé"}
                      {a.motif && <span className="font-normal text-stone-500"> · {a.motif}</span>}
                    </p>
                    <p className="text-sm text-stone-500">
                      {jour(a.debut)}
                      {isoJour(new Date(finAffichee(a.fin))) !== isoJour(new Date(a.debut))
                        && ` → ${jour(finAffichee(a.fin))}`}
                    </p>
                  </div>
                  <button
                    onClick={() => supprimer(a.id)}
                    className="shrink-0 text-sm font-medium text-stone-500 underline underline-offset-4 transition hover:text-red-700"
                  >
                    Retirer
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
