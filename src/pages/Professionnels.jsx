import { useState } from "react"
import { Link } from "react-router-dom"
import { proprietairesApi } from "../api/bookingApi"
import Stepper from "../components/Stepper"
import { Champ } from "./pro/ProDashboard"

const METIERS = [
  ["COIFFURE", "Coiffure", "Coupe, couleur, coiffage"],
  ["BARBIER", "Barbier", "Coupe homme, barbe, rasage"],
  ["ONGLERIE", "Onglerie", "Manucure, pose, nail art"],
  ["ESTHETIQUE", "Esthétique", "Soins du visage, épilation"],
  ["SPA_HAMMAM", "Hammam & spa", "Gommage, massage, beldi"],
  ["AUTRE", "Autre", "Dites-nous en deux mots"],
]

const ANCIENNETES = [
  ["EN_PROJET", "Ouverture en projet"],
  ["MOINS_1_AN", "Moins d'un an"],
  ["DE_1_A_3_ANS", "Entre un et trois ans"],
  ["PLUS_3_ANS", "Plus de trois ans"],
]

const OUTILS = ["Carnet papier", "Agenda téléphone", "Un autre logiciel", "Rien pour l'instant"]

const ETAPES = ["Votre établissement", "Votre activité", "Vous contacter"]

const VIDE = {
  metiers: [], nomEtablissement: "", ville: "", quartier: "", specialite: "",
  anciennete: "", nombreCollaborateurs: "", proprietaireLocal: "", outilActuel: "",
  prenom: "", nom: "", telephone: "", email: "", ice: "", message: "",
}

/**
 * Page d'entrée des professionnels.
 *
 * Il n'y a pas d'inscription à proposer : c'est l'équipe qui installe le
 * salon. Cette page capte donc le prospect, et rien d'autre — aucun compte
 * n'est créé ici.
 *
 * Le formulaire est découpé en trois écrans plutôt qu'affiché d'un bloc. Un
 * gérant qui voit quatorze champs referme la page ; les mêmes questions posées
 * trois par trois se remplissent. L'ordre suit cette logique : d'abord ce dont
 * il est fier — son établissement —, ensuite ce qui nous sert à le qualifier,
 * et seulement à la fin ses coordonnées.
 */
export default function Professionnels() {
  const [etape, setEtape] = useState(0)
  const [form, setForm] = useState(VIDE)
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const [confirme, setConfirme] = useState(null)

  const maj = (cle) => (e) => setForm({ ...form, [cle]: e.target.value })
  const poser = (cle, valeur) => setForm({ ...form, [cle]: valeur })

  const basculerMetier = (valeur) => setForm({
    ...form,
    metiers: form.metiers.includes(valeur)
      ? form.metiers.filter((m) => m !== valeur)
      : [...form.metiers, valeur],
  })
  const champs = envoi.erreur?.details ?? {}

  /* Chaque étape garde ses propres conditions : on ne laisse pas avancer vers
     un envoi que le serveur refusera de toute façon. */
  const etapeValide = [
    form.metiers.length > 0 && form.nomEtablissement.trim() && form.ville.trim(),
    form.anciennete,
    form.prenom.trim() && /^(?:\+212|0)[5-7]\d{8}$/.test(form.telephone.trim())
      && form.email.includes("@"),
  ][etape]

  const envoyer = () => {
    setEnvoi({ enCours: true, erreur: null })
    proprietairesApi
      .demanderDemo({
        nomEtablissement: form.nomEtablissement,
        // Le premier coché est le métier principal : l'ordre des cases est
        // celui dans lequel le prospect a pensé son activité.
        metiers: form.metiers,
        typeEtablissement: form.metiers[0],
        specialite: form.specialite || null,
        ville: form.ville,
        quartier: form.quartier || null,
        anciennete: form.anciennete,
        nombreCollaborateurs: form.nombreCollaborateurs
          ? Number(form.nombreCollaborateurs) : null,
        proprietaireLocal: form.proprietaireLocal === ""
          ? null : form.proprietaireLocal === "oui",
        outilActuel: form.outilActuel || null,
        prenom: form.prenom,
        nom: form.nom || null,
        telephone: form.telephone,
        email: form.email,
        ice: form.ice || null,
        message: form.message || null,
      })
      .then((r) => setConfirme(r.message))
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  if (confirme) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-bold text-stone-900">C'est noté, {form.prenom}</h1>
        <p className="mt-3 text-stone-600">{confirme}</p>
        <p className="mt-6 text-sm text-stone-500">
          Vous n'avez rien à préparer. Le paramétrage — prestations, équipe, horaires —
          se fait avec vous pendant l'installation.
        </p>
        <Link to="/" className="mt-8 inline-block text-sm text-brand-700 underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Espace professionnels
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
          Votre agenda en ligne, installé par nos soins
        </h1>
        <p className="mt-3 text-stone-600">
          Vos clients réservent à toute heure, votre téléphone sonne moins. Nous
          paramétrons vos prestations, votre équipe et vos horaires avec vous —
          vous n'avez rien à saisir.
        </p>
        {/* L'absence de commission est l'argument, pas un détail de tarif :
            autant l'énoncer avant le formulaire. */}
        <ul className="mt-5 grid gap-2 text-sm text-stone-700 sm:grid-cols-3">
          {[
            ["Aucune commission", "sur vos rendez-vous"],
            ["Installation comprise", "catalogue et horaires"],
            ["Sans engagement", "de durée"],
          ].map(([titre, detail]) => (
            <li key={titre} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
              <span className="block font-semibold text-stone-900">{titre}</span>
              <span className="text-stone-500">{detail}</span>
            </li>
          ))}
        </ul>
      </header>

      <div className="mt-9 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <Stepper etapes={ETAPES} courante={etape} onAller={setEtape} />

        <form
          className="mt-7"
          onSubmit={(e) => {
            e.preventDefault()
            if (!etapeValide) return
            if (etape < ETAPES.length - 1) setEtape(etape + 1)
            else envoyer()
          }}
        >
          {etape === 0 && (
            <fieldset>
              {/* Plusieurs métiers, et non un seul.
                  Des boutons radio n'en acceptaient qu'un : un institut qui
                  fait la coiffure, l'onglerie et l'esthétique devait en
                  choisir un, et le conseiller ne savait donc pas ce qu'il
                  allait trouver sur place. */}
              <legend className="text-sm font-medium text-stone-700">
                Quels sont vos métiers ?
              </legend>
              <p className="mt-1 text-xs text-stone-500">
                Cochez tout ce que vous proposez — beaucoup de salons en font plusieurs.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {METIERS.map(([valeur, libelle, detail]) => {
                  const coche = form.metiers.includes(valeur)
                  return (
                    <label
                      key={valeur}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        coche
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() => basculerMetier(valeur)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-stone-900">{libelle}</span>
                        <span className="block text-xs text-stone-500">{detail}</span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Champ label="Nom de l'établissement" value={form.nomEtablissement}
                       onChange={maj("nomEtablissement")} erreur={champs.nomEtablissement}
                       className="sm:col-span-2" required />
                <Champ label="Ville" value={form.ville} onChange={maj("ville")}
                       erreur={champs.ville} required />
                <Champ label="Quartier" value={form.quartier} onChange={maj("quartier")}
                       placeholder="Guéliz, Maarif, Iberia…" />
                <Champ label="Votre spécialité" value={form.specialite}
                       onChange={maj("specialite")} erreur={champs.specialite}
                       placeholder="Coiffure afro, extensions de cils, beldi…"
                       className="sm:col-span-2" />
              </div>
            </fieldset>
          )}

          {etape === 1 && (
            <fieldset className="space-y-6">
              <div>
                <legend className="text-sm font-medium text-stone-700">
                  Depuis combien de temps exercez-vous ici ?
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ANCIENNETES.map(([valeur, libelle]) => (
                    <label
                      key={valeur}
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition ${
                        form.anciennete === valeur
                          ? "border-brand-500 bg-brand-50 font-medium ring-1 ring-brand-300"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <input type="radio" name="anciennete" value={valeur}
                             checked={form.anciennete === valeur}
                             onChange={() => poser("anciennete", valeur)} className="sr-only" />
                      {libelle}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Champ label="Combien êtes-vous à travailler ?" type="number" min="1" max="200"
                       value={form.nombreCollaborateurs}
                       onChange={maj("nombreCollaborateurs")}
                       erreur={champs.nombreCollaborateurs} placeholder="Vous compris" />
                <label className="block">
                  <span className="text-sm text-stone-600">Le local vous appartient ?</span>
                  <select value={form.proprietaireLocal}
                          onChange={maj("proprietaireLocal")}
                          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400">
                    <option value="">Préfère ne pas répondre</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non, je suis locataire</option>
                  </select>
                </label>
              </div>

              <div>
                <span className="text-sm text-stone-600">
                  Comment gérez-vous vos rendez-vous aujourd'hui ?
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTILS.map((outil) => (
                    <button
                      key={outil}
                      type="button"
                      onClick={() => poser("outilActuel", form.outilActuel === outil ? "" : outil)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        form.outilActuel === outil
                          ? "border-brand-500 bg-brand-50 font-medium text-brand-800"
                          : "border-stone-200 text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {outil}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          )}

          {etape === 2 && (
            <fieldset className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ label="Prénom" value={form.prenom} onChange={maj("prenom")}
                       erreur={champs.prenom} required />
                <Champ label="Nom" value={form.nom} onChange={maj("nom")} erreur={champs.nom} />
                <Champ label="Téléphone" value={form.telephone} onChange={maj("telephone")}
                       erreur={champs.telephone} placeholder="0661234567" required />
                <Champ label="E-mail" type="email" value={form.email} onChange={maj("email")}
                       erreur={champs.email} required />
              </div>

              {/* L'ICE ferme la marche : réclamé plus tôt, il transforme une
                  prise de contact en formalité, et personne ne le connaît de
                  mémoire. Il ne sert qu'au moment du contrat. */}
              <Champ label="ICE (facultatif)" value={form.ice} onChange={maj("ice")}
                     erreur={champs.ice} placeholder="15 chiffres, si vous l'avez sous la main" />

              <label className="block">
                <span className="text-sm text-stone-600">Un mot sur votre besoin</span>
                <textarea
                  value={form.message}
                  onChange={maj("message")}
                  rows={3}
                  maxLength={1000}
                  placeholder="Ce qui vous fait perdre du temps, ce que vous attendez…"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>

              <p className="text-xs text-stone-500">
                Vos coordonnées servent uniquement à vous rappeler. Voir nos{" "}
                <Link to="/mentions-legales" className="underline">mentions légales</Link>.
              </p>
            </fieldset>
          )}

          {envoi.erreur && !envoi.erreur.details && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              {envoi.erreur.message}
            </p>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            {etape > 0 ? (
              <button type="button" onClick={() => setEtape(etape - 1)}
                      className="text-sm text-stone-500 hover:text-stone-800">
                Retour
              </button>
            ) : <span />}
            <button
              type="submit"
              disabled={!etapeValide || envoi.enCours}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
            >
              {etape < ETAPES.length - 1
                ? "Continuer"
                : envoi.enCours ? "Envoi…" : "Demander une démonstration"}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-stone-500">
        Déjà client ? <Link to="/pro" className="text-brand-700 underline">Accéder à mon espace</Link>
      </p>
    </div>
  )
}
