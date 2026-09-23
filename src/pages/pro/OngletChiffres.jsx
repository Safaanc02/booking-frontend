import { useCallback, useEffect, useState } from "react"
import { proApi } from "../../api/bookingApi"
import Loader, { ErrorState } from "../../components/Loader"
import { prix, isoDate } from "../../lib/format"

/**
 * Les chiffres du salon.
 *
 * C'est ce que l'outil apporte par-dessus le carnet papier. Le gérant connaît
 * son carnet — il l'a sous les yeux toute la journée. Ce qu'il ne connaît pas,
 * c'est son taux de remplissage, ce que lui coûtent les absences, et la part
 * de ses rendez-vous qui ne passe plus par le téléphone.
 *
 * Trois choix de lecture :
 *
 *   • le manque à gagner est affiché en dirhams, pas en pourcentage. « 12 %
 *     d'absences » ne fait rien ; « 1 800 dirhams non encaissés ce mois-ci »
 *     fait décrocher le téléphone.
 *
 *   • le taux de remplissage disparaît tant que les horaires ne sont pas
 *     saisis, plutôt que d'afficher un zéro. Un chiffre faux est pire qu'une
 *     case vide, parce qu'on le croit.
 *
 *   • la part de réservations en ligne est là pour nous autant que pour lui :
 *     c'est la mesure honnête de l'utilité de DarZin dans ce salon-là.
 */

/** Les périodes qu'un gérant demande spontanément. */
const PERIODES = [
  ["mois", "Ce mois-ci"],
  ["precedent", "Mois dernier"],
  ["trimestre", "3 derniers mois"],
  ["annee", "Cette année"],
]

function bornes(cle) {
  const aujourdhui = new Date()
  const a = aujourdhui.getFullYear()
  const m = aujourdhui.getMonth()
  switch (cle) {
    case "precedent":
      return { depuis: isoDate(new Date(a, m - 1, 1)), jusqua: isoDate(new Date(a, m, 0)) }
    case "trimestre":
      return { depuis: isoDate(new Date(a, m - 2, 1)), jusqua: isoDate(aujourdhui) }
    case "annee":
      return { depuis: isoDate(new Date(a, 0, 1)), jusqua: isoDate(aujourdhui) }
    default:
      return { depuis: isoDate(new Date(a, m, 1)), jusqua: isoDate(aujourdhui) }
  }
}

export default function OngletChiffres({ salon }) {
  const [periode, setPeriode] = useState("mois")
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    proApi
      .statistiques(salon.id, bornes(periode))
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [salon.id, periode])

  useEffect(charger, [charger])

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PERIODES.map(([cle, libelle]) => (
          <button
            key={cle}
            onClick={() => setPeriode(cle)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              periode === cle
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-100"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {etat.statut === "chargement" && <Loader />}
      {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}
      {etat.statut === "ok" && <Chiffres s={etat.data} />}
    </div>
  )
}

function Chiffres({ s }) {
  const rienDuTout = s.honores === 0 && s.aVenir === 0 && s.annules === 0 && s.absents === 0

  if (rienDuTout) {
    return (
      <p className="mt-8 rounded-2xl bg-stone-50 p-8 text-center text-sm text-stone-500 ring-1 ring-stone-200">
        Aucun rendez-vous sur cette période.
      </p>
    )
  }

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte
          titre="Encaissé"
          valeur={prix(s.chiffreAffaires)}
          detail={`${s.honores} rendez-vous honoré${s.honores > 1 ? "s" : ""}`}
        />
        <Carte
          titre="À venir"
          valeur={prix(s.chiffreAttendu)}
          detail={`${s.aVenir} rendez-vous en carnet`}
        />
        <Carte
          titre="Manque à gagner"
          valeur={prix(s.manqueAGagner)}
          detail={`${s.absents} absence${s.absents > 1 ? "s" : ""} · ${s.tauxAbsence} % des rendez-vous joués`}
          alerte={s.absents > 0}
        />
        <Carte
          titre="Remplissage"
          valeur={s.tauxRemplissage === null ? "—" : `${s.tauxRemplissage} %`}
          detail={
            s.tauxRemplissage === null
              ? "Saisissez vos horaires pour l'obtenir"
              : "du temps ouvert, vendu"
          }
        />
      </div>

      {/* La part en ligne mérite sa propre ligne : c'est la seule mesure qui
          dit si l'outil a changé quelque chose au quotidien du salon. */}
      <div className="mt-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-stone-900">Comment les clientes réservent</p>
          <p className="text-sm text-stone-500">
            {s.reservationsEnLigne} en ligne · {s.reservationsTelephone} au téléphone
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.partEnLigne}%` }} />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {s.partEnLigne} % des rendez-vous sont pris en ligne, sans appel à décrocher.
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Tableau
          titre="Prestations"
          vide="Aucune prestation honorée sur la période."
          lignes={s.prestations.map((p) => [p.nom, p.nombre, p.montant])}
        />
        <Tableau
          titre="Équipe"
          vide="Aucun rendez-vous attribué sur la période."
          lignes={s.equipe.map((e) => [e.nom, e.nombre, e.montant])}
        />
      </div>

      {s.annules > 0 && (
        <p className="mt-3 text-xs text-stone-400">
          {s.annules} rendez-vous annulé{s.annules > 1 ? "s" : ""} sur la période — non comptés
          dans l'encaissé ni dans le manque à gagner.
        </p>
      )}
    </>
  )
}

function Carte({ titre, valeur, detail, alerte = false }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${alerte ? "bg-red-50 ring-red-200" : "bg-white ring-stone-200"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{titre}</p>
      <p className={`mt-1 text-2xl font-semibold ${alerte ? "text-red-800" : "text-stone-900"}`}>
        {valeur}
      </p>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
    </div>
  )
}

function Tableau({ titre, lignes, vide }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <p className="text-sm font-medium text-stone-900">{titre}</p>
      {lignes.length === 0 ? (
        <p className="mt-3 text-xs text-stone-400">{vide}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {lignes.map(([nom, nombre, montant]) => (
              <tr key={nom}>
                <td className="py-2 pr-3 text-stone-700">{nom}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-stone-400">{nombre}</td>
                <td className="py-2 text-right font-medium tabular-nums text-stone-900">{prix(montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
