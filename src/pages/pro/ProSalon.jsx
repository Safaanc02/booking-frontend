import { useCallback, useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { prestationsApi, salonsApi } from "../../api/bookingApi"
import Loader, { ErrorState } from "../../components/Loader"
import OngletAgenda from "./OngletAgenda"
import OngletPrestations from "./OngletPrestations"
import OngletEquipe from "./OngletEquipe"
import OngletHoraires from "./OngletHoraires"
import OngletAvis from "./OngletAvis"

const ONGLETS = [
  ["agenda", "Agenda"],
  ["prestations", "Prestations"],
  ["equipe", "Équipe"],
  ["horaires", "Horaires"],
  ["avis", "Avis"],
]

export default function ProSalon() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const onglet = params.get("onglet") ?? "agenda"
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  /**
   * Les données viennent des routes professionnelles, jamais de la fiche
   * publique : celle-ci n'expose que les salons ACTIF, et un salon tout juste
   * créé est EN_ATTENTE. Une première version tentait le public puis se
   * rabattait sur un 404 — un écran de gestion ne doit pas dépendre de la
   * visibilité commerciale du salon.
   */
  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    Promise.all([salonsApi.mesSalons(), prestationsApi.parSalon(id)])
      .then(([salons, prestations]) => {
        const s = salons.find((x) => String(x.id) === String(id))
        if (!s) {
          throw { status: 404, code: "INTROUVABLE", message: "Ce salon ne fait pas partie des vôtres" }
        }
        setEtat({ statut: "ok", data: { ...s, prestations }, erreur: null })
      })
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [id])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") {
    return <div className="mx-auto max-w-4xl px-4 py-10"><ErrorState erreur={etat.erreur} onRetry={charger} /></div>
  }

  const salon = etat.data

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/pro" className="text-sm text-stone-500 hover:text-stone-800">← Mes salons</Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-stone-900">{salon.nom}</h1>
        <p className="text-sm text-stone-500">{salon.ville}</p>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-200">
        {ONGLETS.map(([cle, libelle]) => (
          <button
            key={cle}
            onClick={() => setParams({ onglet: cle })}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm transition ${
              onglet === cle
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {libelle}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {onglet === "agenda" && <OngletAgenda salon={salon} />}
        {onglet === "prestations" && <OngletPrestations salon={salon} onChange={charger} />}
        {onglet === "equipe" && <OngletEquipe salon={salon} />}
        {onglet === "horaires" && <OngletHoraires salon={salon} />}
        {onglet === "avis" && <OngletAvis salon={salon} />}
      </div>
    </div>
  )
}
