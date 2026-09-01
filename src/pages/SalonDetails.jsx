import { useEffect, useState, useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import { prix, duree, telephone } from "../lib/format"
import Loader, { EmptyState, ErrorState } from "../components/Loader"
import ListeAvis from "../components/ListeAvis"
import { NoteResume } from "../components/Etoiles"

export default function SalonDetails() {
  const { id } = useParams()
  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .ficheSalon(id)
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [id])

  useEffect(charger, [charger])

  if (etat.statut === "chargement") return <Loader label="Chargement du salon…" />
  if (etat.statut === "erreur") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState erreur={etat.erreur} onRetry={charger} />
      </div>
    )
  }

  const salon = etat.data
  const prestations = salon.prestations ?? []
  const employes = salon.employes ?? []

  // Regroupement par catégorie, comme sur la fiche d'un vrai salon.
  const groupes = prestations.reduce((acc, p) => {
    const cle = p.categorie || "Prestations"
    ;(acc[cle] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{salon.nom}</h1>
            <NoteResume moyenne={salon.noteMoyenne} nombre={salon.nombreAvis} classe="mt-1" />
            <p className="mt-1 text-stone-600">
              {salon.adresse}
              {salon.quartier && <span className="text-stone-400"> · {salon.quartier}</span>}
            </p>
          </div>
          {salon.ville && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              {salon.ville}
            </span>
          )}
        </div>

        {salon.description && <p className="mt-4 text-sm text-stone-600">{salon.description}</p>}

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-stone-600">
          {salon.telephone && (
            <div>
              <dt className="inline text-stone-400">Téléphone · </dt>
              <dd className="inline">{telephone(salon.telephone)}</dd>
            </div>
          )}
          {salon.email && (
            <div>
              <dt className="inline text-stone-400">Email · </dt>
              <dd className="inline">{salon.email}</dd>
            </div>
          )}
        </dl>
      </header>

      {employes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">L'équipe</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {employes.map((e) => (
              <div key={e.id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
                <p className="font-medium text-stone-900">{e.prenom} {e.nom}</p>
                {e.titre && <p className="text-sm text-stone-500">{e.titre}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-stone-900">Prestations</h2>

        {prestations.length === 0 ? (
          <div className="mt-4">
            <EmptyState titre="Aucune prestation publiée">
              Ce salon n'a pas encore renseigné son catalogue.
            </EmptyState>
          </div>
        ) : (
          Object.entries(groupes).map(([categorie, liste]) => (
            <div key={categorie} className="mt-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
                {categorie}
              </h3>
              <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
                {liste.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900">{p.nom}</p>
                      {p.description && <p className="mt-0.5 text-sm text-stone-500">{p.description}</p>}
                      <p className="mt-1 text-sm text-stone-400">{duree(p.dureeMinutes)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-stone-900">{prix(p.prix)}</span>
                      <Link
                        to={`/salon/${salon.id}/reserver?prestationId=${p.id}`}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        Réserver
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-stone-900">Avis clients</h2>
        <div className="mt-4">
          <ListeAvis salonId={salon.id} />
        </div>
      </section>
    </div>
  )
}
