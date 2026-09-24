import { useCallback, useEffect, useState } from "react"
import { adminApi } from "../../api/bookingApi"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import Etoiles from "../../components/Etoiles"

/**
 * Modération des avis.
 *
 * La route existait, aucun écran ne l'appelait : un avis injurieux ou hors
 * sujet restait sur la fiche du salon, et le seul recours était un appel à
 * quelqu'un capable d'écrire une requête. Pour un salon dont la note décide
 * des réservations, c'est le genre d'attente qui se compte en clients perdus.
 *
 * Modération *a posteriori* : un avis est publié d'emblée. Le contraire — une
 * file d'attente avant publication — donnerait un réseau où les avis
 * arrivent avec deux jours de retard, et laisserait planer le soupçon que le
 * catalogue est trié. On masque ce qui dérape, on ne filtre pas ce qui entre.
 *
 * Masquer est réversible, et l'écran le montre : les avis masqués s'affichent
 * dans leur propre onglet, avec un bouton pour les republier. Une modération
 * sans retour arrière rend le geste plus lourd qu'il ne devrait l'être.
 */

const ONGLETS = [
  ["PUBLIE", "Publiés"],
  ["MASQUE", "Masqués"],
]

const quand = (iso) => new Date(iso).toLocaleDateString("fr-MA", {
  day: "numeric", month: "long", year: "numeric",
})

export default function AdminAvis() {
  const [statut, setStatut] = useState("PUBLIE")
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [enCours, setEnCours] = useState(null)

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    adminApi
      .avis(statut)
      .then((page) => setEtat({ statut: "ok", data: page.content ?? [], erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [statut])

  useEffect(charger, [charger])

  const basculer = (avis) => {
    const vers = avis.statut === "MASQUE" ? "PUBLIE" : "MASQUE"
    setEnCours(avis.id)
    adminApi
      .modererAvis(avis.id, vers)
      .then(() => { setEnCours(null); charger() })
      .catch((erreur) => { setEnCours(null); setEtat((e) => ({ ...e, erreur })) })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(([cle, libelle]) => (
          <button
            key={cle}
            onClick={() => setStatut(cle)}
            aria-pressed={statut === cle}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              statut === cle
                ? "border-brand-600 bg-brand-600 font-medium text-white"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          etat.data.length === 0 ? (
            <EmptyState titre={statut === "MASQUE" ? "Aucun avis masqué" : "Aucun avis publié"}>
              {statut === "MASQUE"
                ? "Rien n'a eu besoin d'être retiré."
                : "Les avis déposés par les clients apparaîtront ici."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Etoiles note={a.note} />
                      <span className="text-sm font-medium text-stone-900">{a.salonNom}</span>
                      <span className="text-sm text-stone-400">
                        {a.auteur ?? "Client"} · {quand(a.creeLe)}
                      </span>
                    </div>
                    {a.commentaire && (
                      <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{a.commentaire}</p>
                    )}
                    {a.reponseSalon && (
                      <p className="mt-2 border-l-2 border-stone-200 pl-3 text-sm text-stone-500">
                        Réponse du salon : {a.reponseSalon}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => basculer(a)}
                    disabled={enCours === a.id}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                      a.statut === "MASQUE"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        : "bg-stone-100 text-stone-700 ring-1 ring-stone-200 hover:bg-red-50 hover:text-red-700"
                    }`}
                  >
                    {enCours === a.id
                      ? "…"
                      : a.statut === "MASQUE" ? "Republier" : "Masquer"}
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
