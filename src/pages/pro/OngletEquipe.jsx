import { useCallback, useEffect, useState } from "react"
import { proApi } from "../../api/bookingApi"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import { Champ } from "./ProDashboard"

export default function OngletEquipe({ salon }) {
  const prestations = salon.prestations ?? []
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [form, setForm] = useState(null)
  const [affectations, setAffectations] = useState({})

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    proApi
      .employes(salon.id)
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [salon.id])

  useEffect(charger, [charger])

  const ajouter = (e) => {
    e.preventDefault()
    proApi
      .creerEmploye(salon.id, form)
      .then(() => { setForm(null); charger() })
      .catch(() => charger())
  }

  const basculer = (employeId, prestationId, coche) => {
    const actuel = affectations[employeId] ?? []
    const suivant = coche ? [...actuel, prestationId] : actuel.filter((x) => x !== prestationId)
    setAffectations({ ...affectations, [employeId]: suivant })
    proApi.affecterPrestations(employeId, suivant)
  }

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-stone-900">Équipe</h2>
        <button
          onClick={() => setForm(form ? null : { prenom: "", nom: "", titre: "" })}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {form ? "Fermer" : "Ajouter un praticien"}
        </button>
      </div>

      {form && (
        <form onSubmit={ajouter} className="mt-4 grid gap-3 rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200 sm:grid-cols-3">
          <Champ label="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required />
          <Champ label="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          <Champ label="Titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Coloriste…" />
          <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 sm:col-span-3 sm:justify-self-start">
            Ajouter
          </button>
        </form>
      )}

      <div className="mt-5">
        {etat.data.length === 0 ? (
          <EmptyState titre="Aucun praticien">
            Ajoutez-vous vous-même pour commencer : sans praticien, aucun créneau n'est proposé.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {etat.data.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{e.prenom} {e.nom}</p>
                    {e.titre && <p className="text-sm text-stone-500">{e.titre}</p>}
                  </div>
                  <button
                    onClick={() => proApi.desactiverEmploye(e.id).then(charger)}
                    className="text-xs text-stone-400 underline hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>

                {/* Sans affectation, le praticien n'apparaît sur aucune prestation. */}
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Prestations réalisées
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {prestations.length === 0 && (
                    <span className="text-sm text-stone-400">Ajoutez d'abord des prestations au catalogue.</span>
                  )}
                  {prestations.map((p) => {
                    const coche = (affectations[e.id] ?? []).includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs ring-1 transition ${
                          coche ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-white text-stone-600 ring-stone-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={coche}
                          onChange={(ev) => basculer(e.id, p.id, ev.target.checked)}
                        />
                        {coche ? "✓ " : ""}{p.nom}
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
