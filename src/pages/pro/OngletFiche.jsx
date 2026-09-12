import { useState } from "react"
import { salonsApi } from "../../api/bookingApi"
import { Champ } from "./ProDashboard"
import { ORDRE_METIERS, libelleMetier } from "../../lib/metiers"
import { analyserCoordonnees } from "../../lib/geolocalisation"
import PhotosSalon from "./PhotosSalon"

/**
 * La fiche du salon, modifiable par son gérant.
 *
 * Elle ne l'était pas. La route existait depuis le début et acceptait tout —
 * nom, adresse, métiers, coordonnées — mais aucun écran ne l'appelait :
 * déménager, ajouter l'onglerie au catalogue de métiers ou corriger un numéro
 * demandait de passer par l'équipe. Pour un produit dont la promesse est
 * précisément d'installer le salon puis de lui rendre les clés, c'était la
 * clé qui manquait.
 *
 * Deux précautions, héritées de ce que la route fait vraiment côté serveur :
 *
 *   • les métiers partent toujours au complet, jamais par omission — une
 *     liste absente laisse en place, une liste vide efface ;
 *   • les coordonnées ne sont effacées que si l'on vide le champ exprès. Les
 *     omettre les conserve, sauf changement de ville ou de quartier, où
 *     l'ancien point désigne l'ancienne adresse et vaut mieux perdu.
 */
export default function OngletFiche({ salon, onChange }) {
  const [form, setForm] = useState(() => ({
    nom: salon.nom ?? "",
    description: salon.description ?? "",
    adresse: salon.adresse ?? "",
    ville: salon.ville ?? "",
    quartier: salon.quartier ?? "",
    coordonnees: salon.latitude != null && salon.longitude != null
      ? `${salon.latitude}, ${salon.longitude}` : "",
    telephone: salon.telephone ?? "",
    email: salon.email ?? "",
    categorie: salon.categorie ?? "COIFFURE",
    metiers: salon.metiers?.length ? [...salon.metiers] : [salon.categorie ?? "COIFFURE"],
    delaiAnnulationHeures: String(salon.delaiAnnulationHeures ?? 24),
  }))
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: null })
  const [erreurPoint, setErreurPoint] = useState(null)

  const maj = (cle) => (e) => {
    setForm((f) => ({ ...f, [cle]: e.target.value }))
    setEnvoi((x) => ({ ...x, ok: false }))
  }

  /**
   * Le métier principal donne sa couleur au salon : il doit rester coché.
   *
   * Décocher le dernier métier laisserait un salon sans aucun, absent de tous
   * les filtres — y compris celui de sa propre couleur.
   */
  const basculerMetier = (cle) => {
    setForm((f) => {
      const dedans = f.metiers.includes(cle)
      if (dedans && f.metiers.length === 1) return f
      const metiers = dedans ? f.metiers.filter((m) => m !== cle) : [...f.metiers, cle]
      return { ...f, metiers, categorie: metiers.includes(f.categorie) ? f.categorie : metiers[0] }
    })
    setEnvoi((x) => ({ ...x, ok: false }))
  }

  const soumettre = (e) => {
    e.preventDefault()

    let point
    try {
      point = analyserCoordonnees(form.coordonnees)
      setErreurPoint(null)
    } catch (erreur) {
      setErreurPoint(erreur.message)
      return
    }

    setEnvoi({ enCours: true, ok: false, erreur: null })
    salonsApi
      .modifier(salon.id, {
        nom: form.nom,
        description: form.description || null,
        adresse: form.adresse,
        ville: form.ville,
        quartier: form.quartier || null,
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        telephone: form.telephone,
        email: form.email || null,
        categorie: form.categorie,
        metiers: form.metiers,
        delaiAnnulationHeures: Number(form.delaiAnnulationHeures),
      })
      .then(() => {
        setEnvoi({ enCours: false, ok: true, erreur: null })
        onChange?.()
      })
      .catch((erreur) => setEnvoi({ enCours: false, ok: false, erreur }))
  }

  const champsEnErreur = envoi.erreur?.details ?? {}

  return (
    <form onSubmit={soumettre} className="space-y-6">
      <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          L'établissement
        </legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Champ label="Nom du salon" value={form.nom} onChange={maj("nom")}
                 erreur={champsEnErreur.nom} required />
          <Champ label="Téléphone" value={form.telephone} onChange={maj("telephone")}
                 erreur={champsEnErreur.telephone} placeholder="0522334455" required />
          <Champ label="Adresse" value={form.adresse} onChange={maj("adresse")}
                 erreur={champsEnErreur.adresse} required className="sm:col-span-2" />
          <Champ label="Ville" value={form.ville} onChange={maj("ville")}
                 erreur={champsEnErreur.ville} required />
          <Champ label="Quartier" value={form.quartier} onChange={maj("quartier")}
                 placeholder="Guéliz, Maarif…" />

          <div className="sm:col-span-2">
            <Champ
              label="Coordonnées GPS (facultatif)"
              value={form.coordonnees}
              onChange={(e) => { maj("coordonnees")(e); setErreurPoint(null) }}
              erreur={erreurPoint}
              placeholder="33.5883, -7.6222"
            />
            <p className="mt-1 text-xs text-stone-500">
              Sur Google Maps, clic droit sur votre salon puis clic sur les deux nombres
              pour les copier. Sans coordonnées, votre salon est situé au centre de son
              quartier — assez pour apparaître dans « salons autour de moi », au quartier
              près.
            </p>
          </div>

          <Champ label="E-mail du salon" type="email" value={form.email} onChange={maj("email")}
                 erreur={champsEnErreur.email} />
          <Champ label="Préavis d'annulation (heures)" type="number" min="0" max="168"
                 value={form.delaiAnnulationHeures} onChange={maj("delaiAnnulationHeures")}
                 erreur={champsEnErreur.delaiAnnulationHeures} />

          <label className="block sm:col-span-2">
            <span className="text-sm text-stone-600">Description</span>
            <textarea
              value={form.description}
              onChange={maj("description")}
              rows={3}
              placeholder="Ce que vous voulez qu'on sache avant de pousser la porte."
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>
      </fieldset>

      <PhotosSalon salon={salon} />

      <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Vos métiers
        </legend>
        <p className="mt-2 text-sm text-stone-500">
          Cochez tout ce que vous faites : un client qui cherche une onglerie doit vous
          trouver, même si vous êtes d'abord un salon de coiffure.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDRE_METIERS.map((cle) => {
            const coche = form.metiers.includes(cle)
            const seul = coche && form.metiers.length === 1
            return (
              <button
                key={cle}
                type="button"
                onClick={() => basculerMetier(cle)}
                aria-pressed={coche}
                title={seul ? "Gardez au moins un métier" : undefined}
                className={`rounded-full border px-3.5 py-2 text-sm transition ${
                  coche
                    ? "border-brand-600 bg-brand-600 font-medium text-white"
                    : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                } ${seul ? "cursor-not-allowed opacity-90" : ""}`}
              >
                {libelleMetier(cle)}
              </button>
            )
          })}
        </div>

        <label className="mt-4 block max-w-xs">
          <span className="text-sm text-stone-600">Métier principal</span>
          <select
            value={form.categorie}
            onChange={maj("categorie")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            {form.metiers.map((m) => (
              <option key={m} value={m}>{libelleMetier(m)}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            Il donne sa couleur à votre salon dans les résultats.
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={envoi.enCours}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {envoi.enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {envoi.ok && (
          <p role="status" className="text-sm font-medium text-emerald-700">
            Fiche enregistrée.
          </p>
        )}
        {envoi.erreur && (
          <p role="alert" className="text-sm text-red-700">
            {envoi.erreur.message}
          </p>
        )}
      </div>
    </form>
  )
}
