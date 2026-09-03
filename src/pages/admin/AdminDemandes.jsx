import { useCallback, useEffect, useState } from "react"
import { adminApi } from "../../api/bookingApi"
import { telephone } from "../../lib/format"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"

const FILES = [
  ["NOUVELLE", "Nouvelles"],
  ["CONTACTEE", "Contactées"],
  ["QUALIFIEE", "Qualifiées"],
  ["CONVERTIE", "Converties"],
  ["PERDUE", "Perdues"],
]

/**
 * Où peut aller une demande depuis son état courant.
 *
 * CONVERTIE n'est pas dans la liste : ce statut n'est jamais posé à la main,
 * il l'est par le référencement lui-même. Un salon convertit la demande, pas
 * un clic — sinon on obtiendrait des demandes « converties » sans salon, et le
 * rendement du formulaire deviendrait faux.
 */
const SUITES = {
  NOUVELLE:  [["CONTACTEE", "Contactée"], ["PERDUE", "Écarter"]],
  CONTACTEE: [["QUALIFIEE", "Qualifiée"], ["PERDUE", "Écarter"]],
  QUALIFIEE: [["PERDUE", "Écarter"]],
  CONVERTIE: [],
  PERDUE:    [["NOUVELLE", "Reprendre"]],
}

const METIERS = {
  COIFFURE: "Coiffure", BARBIER: "Barbier", ONGLERIE: "Onglerie",
  ESTHETIQUE: "Esthétique", SPA_HAMMAM: "Hammam & spa", AUTRE: "Autre",
}
const ANCIENNETES = {
  EN_PROJET: "ouverture en projet", MOINS_1_AN: "moins d'un an",
  DE_1_A_3_ANS: "1 à 3 ans", PLUS_3_ANS: "plus de 3 ans",
}

const dateCourte = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/**
 * File commerciale : les professionnels qui ont demandé à être rappelés.
 *
 * Les demandes sont triées par ancienneté d'arrivée, la plus vieille en
 * haut : une demande de trois jours qui traîne coûte plus qu'une demande
 * d'hier. Les champs de qualification sont affichés d'emblée, sans clic —
 * c'est ce qui permet de décider quelle visite on fait d'abord.
 */
export default function AdminDemandes({ onReferencer }) {
  const [file, setFile] = useState("NOUVELLE")
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [action, setAction] = useState({ id: null, erreur: null })
  const [notes, setNotes] = useState({})

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    adminApi
      .demandes(file)
      .then((page) => setEtat({ statut: "ok", data: page.content ?? [], erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [file])

  useEffect(charger, [charger])

  const avancer = (demande, statut) => {
    setAction({ id: demande.id, erreur: null })
    adminApi
      .traiterDemande(demande.id, statut, notes[demande.id] ?? undefined)
      .then(() => { setAction({ id: null, erreur: null }); charger() })
      .catch((erreur) => setAction({ id: null, erreur }))
  }

  return (
    <div>
      <nav className="flex flex-wrap gap-1 border-b border-stone-200">
        {FILES.map(([cle, libelle]) => (
          <button
            key={cle}
            onClick={() => setFile(cle)}
            className={`border-b-2 px-4 py-2.5 text-sm transition ${
              file === cle
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {libelle}
          </button>
        ))}
      </nav>

      {action.erreur && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {action.erreur.message}
        </p>
      )}

      <div className="mt-6">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre={
              file === "NOUVELLE" ? "Aucune demande en attente" : "Aucune demande dans cette file"
            } />
          ) : (
            <ul className="space-y-3">
              {/* Le serveur renvoie les plus récentes d'abord ; on inverse pour
                  traiter par ordre d'arrivée. Faire attendre le premier venu
                  est le meilleur moyen de le perdre. */}
              {[...etat.data].reverse().map((d) => (
                /* L'identifiant est porté par le DOM : une file contient
                   plusieurs demandes, et un test qui viserait « le bouton
                   Qualifiée » piloterait la première ligne venue. */
                <li key={d.id} data-demande-id={d.id}
                    className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900">{d.nomEtablissement}</p>
                      <p className="mt-0.5 text-sm text-stone-600">
                        {METIERS[d.typeEtablissement] ?? d.typeEtablissement}
                        {d.specialite && <span className="text-stone-500"> · {d.specialite}</span>}
                        {" · "}{d.ville}
                        {d.quartier && <span className="text-stone-400"> ({d.quartier})</span>}
                      </p>
                    </div>
                    <span className="text-xs text-stone-400">
                      reçue le {dateCourte(d.creeLe)}
                    </span>
                  </div>

                  {/* La qualification, visible sans déplier : c'est elle qui
                      décide de l'ordre des visites. */}
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
                    <div><dt className="inline text-stone-400">Activité </dt>
                      <dd className="inline">{ANCIENNETES[d.anciennete] ?? d.anciennete}</dd></div>
                    {d.nombreCollaborateurs != null && (
                      <div><dt className="inline text-stone-400">Équipe </dt>
                        <dd className="inline">{d.nombreCollaborateurs} personne{d.nombreCollaborateurs > 1 ? "s" : ""}</dd></div>
                    )}
                    {d.proprietaireLocal != null && (
                      <div><dt className="inline text-stone-400">Local </dt>
                        <dd className="inline">{d.proprietaireLocal ? "propriétaire" : "locataire"}</dd></div>
                    )}
                    {d.outilActuel && (
                      <div><dt className="inline text-stone-400">Aujourd'hui </dt>
                        <dd className="inline">{d.outilActuel}</dd></div>
                    )}
                    {d.ice && (
                      <div><dt className="inline text-stone-400">ICE </dt>
                        <dd className="inline font-mono text-xs">{d.ice}</dd></div>
                    )}
                  </dl>

                  <p className="mt-3 text-sm text-stone-800">
                    {d.prenom} {d.nom}
                    {" — "}
                    <a href={`tel:${d.telephone}`} className="text-brand-700 underline">
                      {telephone(d.telephone)}
                    </a>
                    {" · "}
                    <a href={`mailto:${d.email}`} className="text-brand-700 underline">{d.email}</a>
                  </p>

                  {d.message && (
                    <blockquote className="mt-3 border-l-2 border-stone-200 pl-3 text-sm italic text-stone-600">
                      {d.message}
                    </blockquote>
                  )}

                  {d.noteInterne && (
                    <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                      <span className="text-stone-400">Suivi</span> {d.noteInterne}
                      {d.traiteParNom && <span className="text-stone-400"> — {d.traiteParNom}</span>}
                    </p>
                  )}

                  {d.salonNom && (
                    <p className="mt-3 text-sm text-emerald-700">
                      Référencé sous « {d.salonNom} »
                    </p>
                  )}

                  {(SUITES[d.statut]?.length > 0 || d.statut === "QUALIFIEE") && (
                    <div className="mt-4 border-t border-stone-100 pt-4">
                      <input
                        value={notes[d.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                        placeholder="Ce qui s'est dit — visible par l'équipe"
                        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Une demande qualifiée s'installe : le formulaire de
                            référencement s'ouvre avec ce qu'elle a déjà dit,
                            plutôt que de faire ressaisir six champs. */}
                        {d.statut === "QUALIFIEE" && (
                          <button
                            onClick={() => onReferencer?.(d)}
                            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                          >
                            Référencer le salon
                          </button>
                        )}
                        {SUITES[d.statut].map(([statut, libelle], i) => (
                          <button
                            key={statut}
                            onClick={() => avancer(d, statut)}
                            disabled={action.id === d.id}
                            className={i === 0 && d.statut !== "QUALIFIEE"
                              ? "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
                              : "rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"}
                          >
                            {libelle}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
