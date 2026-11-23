import { useState } from "react"
import { adminApi } from "../../api/bookingApi"
import { Champ } from "../pro/ProDashboard"
import { ORDRE_METIERS, libelleMetier } from "../../lib/metiers"
import { analyserCoordonnees } from "../../lib/geolocalisation"

const VIDE = {
  nom: "", ville: "", quartier: "", adresse: "", coordonnees: "", telephone: "", email: "",
  categorie: "COIFFURE", metiers: ["COIFFURE"], delaiAnnulationHeures: "24",
  gerantPrenom: "", gerantNom: "", gerantEmail: "", gerantTelephone: "",
  validerImmediatement: true,
}

/**
 * Les métiers déclarés par le prospect ne sont pas ceux du catalogue.
 *
 * « Hammam & spa » se range sous SPA, et AUTRE n'a pas d'équivalent — on
 * retombe alors sur COIFFURE, que le conseiller corrige. Mieux vaut un choix
 * à revoir qu'un champ vide au milieu du formulaire.
 */
const CATEGORIE_POUR = {
  COIFFURE: "COIFFURE", BARBIER: "BARBIER", ONGLERIE: "ONGLERIE",
  ESTHETIQUE: "ESTHETIQUE", SPA_HAMMAM: "SPA",
}

/** Reprend ce que la demande a déjà recueilli. L'adresse reste à saisir. */
const depuisDemande = (d) => {
  if (!d) return VIDE
  /*
   * Tous les métiers de la demande, dédoublonnés.
   *
   * Deux types distincts peuvent tomber sur la même catégorie — AUTRE et
   * COIFFURE, faute d'équivalent — et proposer deux fois la même case ferait
   * douter d'une erreur.
   */
  const declares = d.metiers?.length ? d.metiers : [d.typeEtablissement]
  const metiers = [...new Set(declares.map((t) => CATEGORIE_POUR[t] ?? "COIFFURE"))]
  const metier = metiers[0] ?? "COIFFURE"
  return {
  ...VIDE,
  nom: d.nomEtablissement ?? "",
  ville: d.ville ?? "",
  quartier: d.quartier ?? "",
  telephone: d.telephone ?? "",
  categorie: metier,
  // Les cases cochées suivent les métiers déclarés, pas la valeur par
  // défaut : le conseiller décochait « Coiffure » pour cocher ce que la
  // demande disait déjà.
  metiers,
  gerantPrenom: d.prenom ?? "",
  gerantNom: d.nom ?? "",
  gerantEmail: d.email ?? "",
  gerantTelephone: d.telephone ?? "",
  }
}

/**
 * Référencement d'un salon par l'équipe, pour le compte d'un gérant.
 *
 * C'est le modèle du métier : le salon ne s'inscrit pas seul. Le paramétrage
 * du catalogue est précisément ce qui décourage un professionnel, et le lui
 * épargner est la meilleure garantie qu'il reste. Le gérant reçoit un lien
 * pour choisir son mot de passe — jamais un mot de passe en clair.
 */
export default function ReferencerSalon({ demande }) {
  const [form, setForm] = useState(() => depuisDemande(demande))
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const [resultat, setResultat] = useState(null)
  const [erreurPoint, setErreurPoint] = useState(null)

  const maj = (cle) => (e) => setForm({ ...form, [cle]: e.target.value })
  const champs = envoi.erreur?.details ?? {}

  /**
   * Coche ou décoche un métier.
   *
   * Le premier de la liste est le métier principal : décocher celui-ci promeut
   * le suivant, plutôt que de laisser le salon sans couleur. Un ordre stable
   * évite aussi que la couverture change de teinte à chaque clic.
   */
  const basculerMetier = (cle) => {
    const suivants = form.metiers.includes(cle)
      ? form.metiers.filter((m) => m !== cle)
      : [...form.metiers, cle]
    setForm({ ...form, metiers: suivants, categorie: suivants[0] ?? form.categorie })
  }

  const soumettre = (e) => {
    e.preventDefault()

    /*
     * Les coordonnées sont lues avant tout appel.
     *
     * Une paire mal collée doit s'afficher sous son champ, et non revenir en
     * erreur de validation du serveur au milieu d'un formulaire de vingt
     * lignes. Le message dit quoi vérifier — l'ordre latitude/longitude, la
     * faute qu'on ne voit pas après coup.
     */
    let point
    try {
      point = analyserCoordonnees(form.coordonnees)
      setErreurPoint(null)
    } catch (erreur) {
      setErreurPoint(erreur.message)
      return
    }

    setEnvoi({ enCours: true, erreur: null })
    setResultat(null)
    adminApi
      .referencerSalon({
        salon: {
          nom: form.nom, ville: form.ville, quartier: form.quartier || null,
          adresse: form.adresse, telephone: form.telephone,
          latitude: point?.lat ?? null, longitude: point?.lng ?? null,
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

      {demande && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
          Prérempli depuis la demande de {demande.prenom} {demande.nom}. Il reste
          l’adresse exacte à renseigner — et la demande sera marquée convertie.
        </p>
      )}

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
            {/* Après le quartier : c'est la même information, en plus précise.
                Laissé vide, le salon est placé au centre de son quartier — ce
                qui suffit à le classer parmi les salons de sa ville. */}
            <div className="sm:col-span-2">
              <Champ
                label="Coordonnées GPS (facultatif)"
                value={form.coordonnees}
                onChange={maj("coordonnees")}
                erreur={erreurPoint}
                placeholder="33.5883, -7.6222"
              />
              <p className="mt-1 text-xs text-stone-500">
                Sur Google Maps, clic droit sur le salon puis clic sur les deux nombres
                pour les copier. Sans coordonnées, le salon est situé au centre de son
                quartier — assez pour apparaître dans « salons autour de moi », au
                quartier près.
              </p>
            </div>
            <Champ label="Téléphone du salon" value={form.telephone} onChange={maj("telephone")}
                   erreur={champs["salon.telephone"]} placeholder="0539112233" required />
            <Champ label="E-mail du salon" type="email" value={form.email} onChange={maj("email")} erreur={champs["salon.email"]} />
            <Champ label="Préavis d'annulation (heures)" type="number" min="0" max="168"
                   value={form.delaiAnnulationHeures} onChange={maj("delaiAnnulationHeures")} />

            {/* Plusieurs métiers, et non un seul.
                L'institut de quartier fait la coiffure, l'onglerie et
                l'esthétique : n'en retenir qu'un le rendait introuvable pour
                les deux autres. Le premier coché devient le principal — c'est
                lui qui donne au salon sa couleur dans l'interface. */}
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-stone-600">Métiers exercés</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ORDRE_METIERS.map((cle) => {
                  const coche = form.metiers.includes(cle)
                  const principal = form.metiers[0] === cle
                  return (
                    <label
                      key={cle}
                      className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm transition ${
                        coche
                          ? "border-brand-600 bg-brand-600 font-medium text-white"
                          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() => basculerMetier(cle)}
                        className="sr-only"
                      />
                      {libelleMetier(cle)}
                      {principal && (
                        <span className="ml-1.5 text-[11px] font-normal text-brand-100">
                          principal
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
              {form.metiers.length === 0 && (
                <p className="mt-2 text-xs text-red-600">Cochez au moins un métier.</p>
              )}
            </fieldset>
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
          disabled={envoi.enCours || form.metiers.length === 0}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
        >
          {envoi.enCours ? "Référencement…" : "Référencer le salon"}
        </button>
      </form>
    </div>
  )
}
