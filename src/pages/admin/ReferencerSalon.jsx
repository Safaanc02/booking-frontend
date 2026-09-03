import { useState } from "react"
import { adminApi } from "../../api/bookingApi"
import { Champ } from "../pro/ProDashboard"

const CATEGORIES = [
  ["COIFFURE", "Coiffure"], ["BARBIER", "Barbier"], ["ONGLERIE", "Onglerie"],
  ["ESTHETIQUE", "Esthétique"], ["SPA", "Hammam & spa"],
]

const VIDE = {
  nom: "", ville: "", quartier: "", adresse: "", telephone: "", email: "",
  categorie: "COIFFURE", delaiAnnulationHeures: "24",
  gerantPrenom: "", gerantNom: "", gerantEmail: "", gerantTelephone: "",
  validerImmediatement: true,
}

/**
 * Référencement d'un salon par l'équipe, pour le compte d'un gérant.
 *
 * C'est le modèle du métier : le salon ne s'inscrit pas seul. Le paramétrage
 * du catalogue est précisément ce qui décourage un professionnel, et le lui
 * épargner est la meilleure garantie qu'il reste. Le gérant reçoit un lien
 * pour choisir son mot de passe — jamais un mot de passe en clair.
 */
export default function ReferencerSalon() {
  const [form, setForm] = useState(VIDE)
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const [resultat, setResultat] = useState(null)

  const maj = (cle) => (e) => setForm({ ...form, [cle]: e.target.value })
  const champs = envoi.erreur?.details ?? {}

  const soumettre = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    setResultat(null)
    adminApi
      .referencerSalon({
        salon: {
          nom: form.nom, ville: form.ville, quartier: form.quartier || null,
          adresse: form.adresse, telephone: form.telephone,
          email: form.email || null, categorie: form.categorie,
          delaiAnnulationHeures: Number(form.delaiAnnulationHeures),
        },
        proprietaire: {
          prenom: form.gerantPrenom, nom: form.gerantNom || null,
          email: form.gerantEmail, telephone: form.gerantTelephone || null,
        },
        validerImmediatement: form.validerImmediatement,
      })
      .then((r) => {
        setResultat(r)
        setForm(VIDE)
        setEnvoi({ enCours: false, erreur: null })
      })
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  return (
    <div>
      <h2 className="font-semibold text-stone-900">Référencer un salon</h2>
      <p className="mt-1 text-sm text-stone-500">
        Le compte du gérant est créé, et il reçoit un e-mail pour choisir son mot de passe.
        Vous pourrez ensuite paramétrer son catalogue et ses horaires à sa place.
      </p>

      {/* Une invitation non partie n'annule pas le référencement, mais le gérant
          ne peut pas se connecter : l'écran doit le dire, pas l'enterrer. */}
      {resultat && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
            resultat.invitationEnvoyee
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
        >
          <p className="font-medium">{resultat.salon.nom} est référencé.</p>
          <p className="mt-1">{resultat.message}</p>
          <p className="mt-1 opacity-80">Identifiant du gérant : {resultat.emailProprietaire}</p>
        </div>
      )}

      <form onSubmit={soumettre} className="mt-5 space-y-6">
        <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            L'établissement
          </legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <Champ label="Nom du salon" value={form.nom} onChange={maj("nom")} erreur={champs["salon.nom"]} required />
            <Champ label="Ville" value={form.ville} onChange={maj("ville")} erreur={champs["salon.ville"]} required />
            <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")} erreur={champs["salon.adresse"]} required className="sm:col-span-2" />
            <Champ label="Quartier" value={form.quartier} onChange={maj("quartier")} placeholder="Guéliz, Maarif…" />
            <Champ label="Téléphone du salon" value={form.telephone} onChange={maj("telephone")}
                   erreur={champs["salon.telephone"]} placeholder="0539112233" required />
            <Champ label="E-mail du salon" type="email" value={form.email} onChange={maj("email")} erreur={champs["salon.email"]} />
            <label className="block">
              <span className="text-sm text-stone-600">Activité</span>
              <select value={form.categorie} onChange={maj("categorie")}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400">
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <Champ label="Préavis d'annulation (heures)" type="number" min="0" max="168"
                   value={form.delaiAnnulationHeures} onChange={maj("delaiAnnulationHeures")} />
          </div>
        </fieldset>

        <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Le gérant
          </legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <Champ label="Prénom" value={form.gerantPrenom} onChange={maj("gerantPrenom")}
                   erreur={champs["proprietaire.prenom"]} required />
            <Champ label="Nom" value={form.gerantNom} onChange={maj("gerantNom")} />
            <Champ label="E-mail" type="email" value={form.gerantEmail} onChange={maj("gerantEmail")}
                   erreur={champs["proprietaire.email"]} required className="sm:col-span-2" />
            <Champ label="Téléphone" value={form.gerantTelephone} onChange={maj("gerantTelephone")}
                   erreur={champs["proprietaire.telephone"]} placeholder="0661998877" />
          </div>
          {/* L'e-mail sert d'identifiant : un seul élément à retenir, plutôt
              qu'un nom d'utilisateur choisi par un conseiller et oublié. */}
          <p className="mt-3 text-sm text-stone-500">
            Cette adresse sera son identifiant de connexion, et recevra le lien pour
            choisir son mot de passe.
          </p>
        </fieldset>

        <label className="flex items-start gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <input
            type="checkbox"
            checked={form.validerImmediatement}
            onChange={(e) => setForm({ ...form, validerImmediatement: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-stone-700">
            <span className="font-medium text-stone-900">Mettre en ligne tout de suite</span>
            <br />
            À cocher quand l'installation se fait avec le gérant. Sinon le salon reste
            en attente, et vous le validez depuis l'onglet « À valider ».
          </span>
        </label>

        {envoi.erreur && !envoi.erreur.details && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {envoi.erreur.message}
          </p>
        )}

        <button
          type="submit"
          disabled={envoi.enCours}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
        >
          {envoi.enCours ? "Référencement…" : "Référencer le salon"}
        </button>
      </form>
    </div>
  )
}
