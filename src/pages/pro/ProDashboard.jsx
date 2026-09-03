import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { salonsApi } from "../../api/bookingApi"
import { telephone } from "../../lib/format"
import Loader, { ErrorState } from "../../components/Loader"

const LIBELLES = {
  EN_ATTENTE: ["En attente de validation", "bg-amber-50 text-amber-700 ring-amber-200"],
  ACTIF:      ["En ligne", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  SUSPENDU:   ["Suspendu", "bg-red-50 text-red-700 ring-red-200"],
}

export default function ProDashboard() {
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    salonsApi
      .mesSalons()
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState erreur={etat.erreur} onRetry={charger} /></div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Mes salons</h1>
      </div>

      {/* Arriver ici sans salon est une anomalie dans le modèle : le salon est
          installé avant que le compte n'existe. Deux cas subsistent — un membre
          d'équipe, qu'on oriente vers son planning, et un rattachement qui a
          échoué, où seule l'équipe peut agir. Dans les deux cas, proposer une
          création serait un faux espoir : ce compte n'a pas ce droit. */}
      {etat.data.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
          <p className="font-medium text-stone-900">Aucun salon rattaché à ce compte</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">
            Votre établissement est installé par notre équipe : fiche, catalogue,
            équipe et horaires sont paramétrés avec vous, puis vous en gardez la main.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-stone-500">
            Vous faites partie d'une équipe ? Vos rendez-vous sont dans{" "}
            <Link to="/mon-planning" className="text-brand-700 underline">Mon planning</Link>.
          </p>
          <a
            href="mailto:contact@booking.ma"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Contacter l'équipe
          </a>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {etat.data.map((s) => {
          const [libelle, classes] = LIBELLES[s.statut] ?? [s.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
          return (
            <li key={s.id}>
              <Link
                to={`/pro/salon/${s.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:ring-brand-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{s.nom}</p>
                      {/* On distingue ce qu'on possède de ce qu'on gère : le
                          gestionnaire n'a pas le droit de supprimer le salon. */}
                      {s.monRole === "GESTIONNAIRE" && (
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
                          Gestion déléguée
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {s.adresse} · {s.ville}
                    </p>
                    {s.telephone && <p className="mt-1 text-sm text-stone-400">{telephone(s.telephone)}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>
                    {libelle}
                  </span>
                </div>
                {s.statut === "EN_ATTENTE" && (
                  <p className="mt-3 text-xs text-amber-700">
                    Votre salon n'apparaît pas encore dans la recherche. Vous pouvez déjà le
                    paramétrer, il sera visible dès validation.
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Champ({ label, erreur, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm text-stone-600">{label}</span>
      <input
        {...props}
        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
          erreur ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-brand-400"
        }`}
      />
      {erreur && <span className="mt-1 block text-xs text-red-600">{erreur}</span>}
    </label>
  )
}
