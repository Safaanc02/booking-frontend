import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { annulationApi } from "../api/bookingApi"
import { prix, instantLong, telephone } from "../lib/format"
import Loader, { ErrorState } from "../components/Loader"

const ANNULEES = new Set(["ANNULEE_CLIENT", "ANNULEE_SALON"])

/**
 * Annulation depuis le lien reçu par email, sans connexion.
 *
 * Un aperçu s'affiche d'abord, et rien n'est modifié avant un clic explicite :
 * le lien peut avoir été ouvert par mégarde, ou préchargé par un client de
 * messagerie.
 */
export default function AnnulationParLien() {
  const [params] = useSearchParams()
  const token = params.get("token")

  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })

  const charger = useCallback(() => {
    if (!token) {
      setEtat({ statut: "erreur", data: null, erreur: { message: "Lien d'annulation incomplet" } })
      return
    }
    setEtat({ statut: "chargement", data: null, erreur: null })
    annulationApi
      .apercu(token)
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [token])

  useEffect(charger, [charger])

  const confirmer = () => {
    setEnvoi({ enCours: true, erreur: null })
    annulationApi
      .confirmer(token)
      .then((data) => { setEtat({ statut: "ok", data, erreur: null }); setEnvoi({ enCours: false, erreur: null }) })
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  if (etat.statut === "chargement") return <Loader label="Vérification du lien…" />

  if (etat.statut === "erreur") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <ErrorState erreur={etat.erreur} />
        <p className="mt-4 text-center text-sm text-stone-500">
          <Link to="/compte" className="text-brand-700 underline">Voir mes réservations</Link>
        </p>
      </div>
    )
  }

  const r = etat.data
  const dejaAnnulee = ANNULEES.has(r.statut)

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        {dejaAnnulee ? (
          <>
            <h1 className="text-xl font-semibold text-stone-900">Rendez-vous annulé</h1>
            <p className="mt-2 text-sm text-stone-600">
              C'est fait. Le créneau est de nouveau disponible — merci d'avoir prévenu.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-stone-900">Annuler ce rendez-vous ?</h1>
            <p className="mt-2 text-sm text-stone-600">
              Vérifiez qu'il s'agit bien du bon, rien n'est encore modifié.
            </p>
          </>
        )}

        <dl className="mt-5 divide-y divide-stone-100 text-sm">
          {[
            ["Salon", r.salon],
            ["Prestation", r.prestation],
            ["Praticien", r.employe ?? "—"],
            ["Date", instantLong(r.debut)],
            ["Montant", prix(r.prix)],
          ].map(([cle, valeur]) => (
            <div key={cle} className="flex justify-between gap-4 py-2.5">
              <dt className="text-stone-500">{cle}</dt>
              <dd className="text-right font-medium text-stone-900">{valeur}</dd>
            </div>
          ))}
        </dl>

        {envoi.erreur && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            {envoi.erreur.message}
          </p>
        )}

        {!dejaAnnulee && (
          r.annulable ? (
            <button
              onClick={confirmer}
              disabled={envoi.enCours}
              className="mt-5 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:bg-stone-300"
            >
              {envoi.enCours ? "Annulation…" : "Confirmer l'annulation"}
            </button>
          ) : (
            /* Hors délai : on ne propose pas un bouton que le serveur refuserait.
               On donne le numéro du salon — le but reste d'éviter un no-show. */
            <div className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
              <p className="font-medium text-stone-900">Annulation en ligne close</p>
              <p className="mt-1">
                Ce salon demande {r.delaiAnnulationHeures} h de préavis. Appelez-le
                au <span className="font-medium">{telephone(r.salonTelephone)}</span> pour
                le prévenir — cela vaut mieux qu'une absence.
              </p>
            </div>
          )
        )}

        <p className="mt-5 text-center text-sm">
          <Link to="/" className="text-stone-500 hover:text-stone-800">Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  )
}
