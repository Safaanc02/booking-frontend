import { useState } from "react"
import { prestationsApi } from "../../api/bookingApi"
import { prix, duree } from "../../lib/format"
import { EmptyState } from "../../components/Loader"
import { Champ } from "./ProDashboard"

/** Catalogue pré-rempli par métier : c'est le paramétrage initial qui décourage le plus. */
const MODELES = {
  COIFFURE: [
    { nom: "Coupe femme", categorie: "Coupe", prix: 200, dureeMinutes: 45 },
    { nom: "Brushing", categorie: "Coiffage", prix: 120, dureeMinutes: 30 },
    { nom: "Coloration", categorie: "Couleur", prix: 450, dureeMinutes: 90 },
    { nom: "Balayage", categorie: "Couleur", prix: 650, dureeMinutes: 120 },
  ],
  BARBIER: [
    { nom: "Coupe homme", categorie: "Coupe", prix: 80, dureeMinutes: 30 },
    { nom: "Barbe", categorie: "Barbe", prix: 50, dureeMinutes: 20 },
    { nom: "Coupe + barbe", categorie: "Forfait", prix: 120, dureeMinutes: 45 },
  ],
  ONGLERIE: [
    { nom: "Manucure simple", categorie: "Mains", prix: 100, dureeMinutes: 30 },
    { nom: "Pose vernis semi-permanent", categorie: "Mains", prix: 180, dureeMinutes: 60 },
    { nom: "Pédicure", categorie: "Pieds", prix: 150, dureeMinutes: 45 },
  ],
  ESTHETIQUE: [
    { nom: "Épilation sourcils", categorie: "Épilation", prix: 60, dureeMinutes: 15 },
    { nom: "Soin du visage", categorie: "Soin", prix: 350, dureeMinutes: 60 },
  ],
  SPA: [
    { nom: "Hammam traditionnel", categorie: "Hammam", prix: 200, dureeMinutes: 60 },
    { nom: "Massage relaxant", categorie: "Massage", prix: 400, dureeMinutes: 60 },
  ],
}

export default function OngletPrestations({ salon, onChange }) {
  const prestations = salon.prestations ?? []
  const [form, setForm] = useState(null)
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })

  const enregistrer = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    prestationsApi
      .creer(salon.id, {
        nom: form.nom,
        categorie: form.categorie || null,
        description: form.description || null,
        prix: Number(form.prix),
        dureeMinutes: Number(form.dureeMinutes),
      })
      .then(() => { setForm(null); setEnvoi({ enCours: false, erreur: null }); onChange() })
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const modeles = MODELES[salon.categorie] ?? MODELES.COIFFURE
  const champs = envoi.erreur?.details ?? {}

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-stone-900">Catalogue</h2>
        <button
          onClick={() => setForm(form ? null : { nom: "", categorie: "", description: "", prix: "", dureeMinutes: "" })}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {form ? "Fermer" : "Ajouter une prestation"}
        </button>
      </div>

      {form && (
        <form onSubmit={enregistrer} className="mt-4 rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
          {/* Pré-remplissage : cliquer un modèle vaut mieux que tout ressaisir. */}
          <p className="text-sm text-stone-600">Partir d'un modèle :</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {modeles.map((m) => (
              <button
                key={m.nom}
                type="button"
                onClick={() => setForm({ ...m, description: "", prix: String(m.prix), dureeMinutes: String(m.dureeMinutes) })}
                className="rounded-full bg-white px-3 py-1.5 text-xs text-stone-700 ring-1 ring-stone-200 hover:ring-brand-300"
              >
                {m.nom} · {prix(m.prix)}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Champ label="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} erreur={champs.nom} required />
            <Champ label="Catégorie" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} placeholder="Coupe, Couleur…" />
            <Champ label="Prix (MAD)" type="number" min="1" step="0.01" value={form.prix}
                   onChange={(e) => setForm({ ...form, prix: e.target.value })} erreur={champs.prix} required />
            <Champ label="Durée (minutes)" type="number" min="5" max="480" step="5" value={form.dureeMinutes}
                   onChange={(e) => setForm({ ...form, dureeMinutes: e.target.value })} erreur={champs.dureeMinutes} required />
            <Champ label="Description" value={form.description}
                   onChange={(e) => setForm({ ...form, description: e.target.value })} className="sm:col-span-2" />
          </div>

          {envoi.erreur && !envoi.erreur.details && (
            <p className="mt-3 text-sm text-red-700">{envoi.erreur.message}</p>
          )}

          <button type="submit" disabled={envoi.enCours}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300">
            {envoi.enCours ? "Enregistrement…" : "Ajouter"}
          </button>
        </form>
      )}

      <div className="mt-5">
        {prestations.length === 0 ? (
          <EmptyState titre="Aucune prestation">
            Sans catalogue, personne ne peut réserver. Commencez par un modèle ci-dessus.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {prestations.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{p.nom}</p>
                  <p className="text-sm text-stone-500">
                    {p.categorie && <span className="text-stone-400">{p.categorie} · </span>}
                    {duree(p.dureeMinutes)}
                  </p>
                </div>
                <span className="font-semibold text-stone-900">{prix(p.prix)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
