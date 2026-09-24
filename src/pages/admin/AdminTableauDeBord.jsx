import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { adminApi } from "../../api/bookingApi"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import { prix, instantLong } from "../../lib/format"

/**
 * L'état de la plateforme.
 *
 * Volontairement court. Un tableau de bord qui affiche tout ce qu'on sait
 * compter ne fait rien remarquer : on le regarde une fois, puis plus jamais.
 * Les chiffres du haut situent ; la liste du bas appelle un geste.
 *
 * Les salons dormants sont la raison d'être de l'écran. Un salon installé qui
 * ne reçoit aucune réservation ne restera pas : il ne verra jamais ce que le
 * produit lui apporte, et il partira sans rien dire. C'est le seul indicateur
 * qu'on peut encore rattraper — d'où la liste nommée, avec ce qui distingue
 * les deux causes.
 */

const FENETRES = [[7, "7 jours"], [30, "30 jours"], [90, "90 jours"]]

const LIBELLES_ACTIVITE = {
  CONFIRMEE: "À venir",
  HONOREE: "Honorées",
  ANNULEE_CLIENT: "Annulées par le client",
  ANNULEE_SALON: "Annulées par le salon",
  ABSENT: "Absences",
  EN_ATTENTE: "En attente",
}

const LIBELLES_FILE = {
  NOUVELLE: "Nouvelles",
  CONTACTEE: "Contactées",
  QUALIFIEE: "Qualifiées",
  CONVERTIE: "Converties",
  PERDUE: "Perdues",
}

export default function AdminTableauDeBord() {
  const [jours, setJours] = useState(30)
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    adminApi
      .tableauDeBord(jours)
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [jours])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  const d = etat.data
  const actifs = d.reseau.ACTIF ?? 0
  const dormants = d.salonsDormants ?? []
  // Une part, pas un compte : « 33 salons sans réservation » ne dit rien sans
  // savoir s'il y en a 36 ou 3 600.
  const partDormants = actifs > 0 ? Math.round((100 * dormants.length) / actifs) : 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {FENETRES.map(([n, libelle]) => (
            <button
              key={n}
              onClick={() => setJours(n)}
              aria-pressed={jours === n}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                jours === n
                  ? "border-brand-600 bg-brand-600 font-medium text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre libelle="Salons en ligne" valeur={actifs}
                 detail={`${d.reseau.EN_ATTENTE ?? 0} en attente · ${d.reseau.SUSPENDU ?? 0} suspendus`} />
        <Chiffre libelle="Rendez-vous" valeur={Object.values(d.activite).reduce((a, b) => a + b, 0)}
                 detail={`sur ${jours} jours`} />
        <Chiffre libelle="Volume honoré" valeur={prix(d.volumeMad)}
                 detail="prestations réellement réalisées" />
        <Chiffre
          libelle="Conversion"
          valeur={d.tauxConversionPourcent == null ? "—" : `${d.tauxConversionPourcent} %`}
          detail={d.tauxConversionPourcent == null
            ? "aucune demande tranchée"
            : "des demandes tranchées"}
        />
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Repartition titre="Rendez-vous" valeurs={d.activite} libelles={LIBELLES_ACTIVITE} />
        <Repartition titre="File commerciale" valeurs={d.fileCommerciale} libelles={LIBELLES_FILE} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-stone-900">
          Salons sans aucune réservation
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {dormants.length === 0
            ? `Tous les salons en ligne ont reçu au moins un rendez-vous sur ${jours} jours.`
            : `${dormants.length} sur ${actifs} salons en ligne, soit ${partDormants} %. `
              + "Un salon qui ne reçoit rien ne verra jamais ce que la plateforme lui apporte."}
        </p>

        {dormants.length === 0 ? (
          <div className="mt-4">
            <EmptyState titre="Rien à rattraper" />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {dormants.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2.5 font-medium text-stone-900">
                    {s.nom}
                    {/* Deux causes, deux gestes : un catalogue vide se termine,
                        un catalogue rempli sans réservation se discute. */}
                    {s.catalogueVide ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                        Installation à terminer
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200">
                        À rappeler
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {s.ville ?? "Ville inconnue"}
                    {s.installeLe && <span className="text-stone-400"> · installé le {instantLong(s.installeLe)}</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {s.derniereReservation
                      ? `Dernier rendez-vous le ${instantLong(s.derniereReservation)}`
                      : "Jamais aucune réservation"}
                  </p>
                </div>
                <Link
                  to={`/salon/${s.id}`}
                  className="shrink-0 text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Voir la fiche
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Chiffre({ libelle, valeur, detail }) {
  /*
   * Un montant est plus long qu'un décompte.
   *
   * « 86 » et « 12.800,00 MAD » ne tiennent pas la même place, et le second
   * touchait déjà le bord de sa carte. À sept chiffres — ce qu'un réseau qui
   * marche atteint en quelques mois — il aurait débordé. La taille suit donc
   * la longueur, plutôt que d'attendre que le succès casse la mise en page.
   */
  const long = String(valeur).length > 9

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <dt className="text-xs uppercase tracking-wide text-stone-400">{libelle}</dt>
      <dd className={`mt-1 font-bold tabular-nums leading-tight text-stone-900 ${
        long ? "text-xl" : "text-2xl"
      }`}>
        {valeur}
      </dd>
      {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
    </div>
  )
}

/** Une répartition, écrite en lignes : quatre nombres ne font pas un graphique. */
function Repartition({ titre, valeurs, libelles }) {
  const lignes = Object.entries(valeurs).filter(([, n]) => n > 0)
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <h3 className="text-xs uppercase tracking-wide text-stone-400">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Rien sur la période.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {lignes.map(([cle, n]) => (
            <li key={cle} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-stone-600">{libelles[cle] ?? cle}</span>
              <span className="font-semibold tabular-nums text-stone-900">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
