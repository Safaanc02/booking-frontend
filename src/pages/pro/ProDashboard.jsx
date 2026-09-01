import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { salonsApi } from "../../api/bookingApi"
import { telephone } from "../../lib/format"
import Loader, { ErrorState } from "../../components/Loader"

const CATEGORIES = ["COIFFURE", "BARBIER", "ONGLERIE", "ESTHETIQUE", "SPA"]
const LIBELLES = {
  EN_ATTENTE: ["En attente de validation", "bg-amber-50 text-amber-700 ring-amber-200"],
  ACTIF:      ["En ligne", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  SUSPENDU:   ["Suspendu", "bg-red-50 text-red-700 ring-red-200"],
}

export default function ProDashboard() {
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [creation, setCreation] = useState(false)

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    salonsApi
      .mesSalons()
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState erreur={etat.erreur} onRetry={charger} /></div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Mes salons</h1>
        {etat.data.length > 0 && !creation && (
          <button
            onClick={() => setCreation(true)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Ajouter un salon
          </button>
        )}
      </div>

      {etat.data.length === 0 && !creation && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
          <p className="font-medium text-stone-900">Référencez votre salon</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">
            Prestations, équipe et horaires : une quinzaine de minutes, et vos clients
            réservent en ligne à toute heure.
          </p>
          <button
            onClick={() => setCreation(true)}
            className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Commencer
          </button>
        </div>
      )}

      {creation && <FormulaireSalon onAnnuler={() => setCreation(false)} onCree={() => { setCreation(false); charger() }} />}

      <ul className="mt-6 space-y-3">
        {etat.data.map((s) => {
          const [libelle, classes] = LIBELLES[s.statut] ?? [s.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
          return (
            <li key={s.id}>
              <Link
                to={`/pro/salon/${s.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:ring-brand-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">{s.nom}</p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {s.adresse} · {s.ville}
                    </p>
                    {s.telephone && <p className="mt-1 text-sm text-stone-400">{telephone(s.telephone)}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>
                    {libelle}
                  </span>
                </div>
                {s.statut === "EN_ATTENTE" && (
                  <p className="mt-3 text-xs text-amber-700">
                    Votre salon n'apparaît pas encore dans la recherche. Vous pouvez déjà le
                    paramétrer, il sera visible dès validation.
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FormulaireSalon({ onAnnuler, onCree }) {
  const [form, setForm] = useState({
    nom: "", adresse: "", ville: "", quartier: "",
    telephone: "", email: "", categorie: "COIFFURE",
  })
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const soumettre = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    salonsApi
      .creer(form)
      .then(onCree)
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const champs = envoi.erreur?.details ?? {}

  return (
    <form onSubmit={soumettre} className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <h2 className="font-semibold text-stone-900">Nouveau salon</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Champ label="Nom du salon" value={form.nom} onChange={maj("nom")} erreur={champs.nom} required />
        <Champ label="Ville" value={form.ville} onChange={maj("ville")} erreur={champs.ville} required />
        <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")} erreur={champs.adresse} required className="sm:col-span-2" />
        <Champ label="Quartier" value={form.quartier} onChange={maj("quartier")} erreur={champs.quartier} placeholder="Guéliz, Maarif…" />
        <Champ label="Téléphone" value={form.telephone} onChange={maj("telephone")} erreur={champs.telephone} placeholder="0612345678" required />
        <Champ label="Email" type="email" value={form.email} onChange={maj("email")} erreur={champs.email} />
        <label className="block">
          <span className="text-sm text-stone-600">Catégorie</span>
          <select
            value={form.categorie}
            onChange={maj("categorie")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
      </div>

      {envoi.erreur && !envoi.erreur.details && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {envoi.erreur.message}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={envoi.enCours}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
        >
          {envoi.enCours ? "Création…" : "Créer le salon"}
        </button>
        <button type="button" onClick={onAnnuler} className="text-sm text-stone-500 hover:text-stone-800">
          Annuler
        </button>
      </div>
    </form>
  )
}

export function Champ({ label, erreur, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm text-stone-600">{label}</span>
      <input
        {...props}
        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
          erreur ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-brand-400"
        }`}
      />
      {erreur && <span className="mt-1 block text-xs text-red-600">{erreur}</span>}
    </label>
  )
}
