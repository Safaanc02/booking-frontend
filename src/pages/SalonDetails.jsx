import { useEffect, useState, useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import { prix, duree, telephone, urlApi } from "../lib/format"
import Loader, { ErrorState } from "../components/Loader"
import ListeAvis from "../components/ListeAvis"
import Couverture, { Initiales } from "../components/Couverture"
import { EtoileHuit } from "../components/Motifs"
import { Horloge, Etiquette } from "../components/Glyphes"
import { libelleMetier, metiersDuSalon } from "../lib/metiers"

/**
 * Fiche d'un salon.
 *
 * Refonte de la mise en page. L'ancienne empilait tout dans une colonne de
 * 768 px : sur un écran large, les deux tiers de la page étaient vides, et il
 * fallait faire défiler la moitié des avis pour retrouver un bouton de
 * réservation. Trois changements :
 *
 *   • un bandeau d'identité en tête, où le nom se lit sur les couleurs du
 *     salon — le même dégradé que sa carte dans les résultats, ce qui fait
 *     reconnaître l'établissement d'un écran à l'autre ;
 *
 *   • deux colonnes sur grand écran, avec un panneau de réservation collant.
 *     Le prix d'entrée et le bouton restent sous les yeux, quelle que soit la
 *     longueur des avis ;
 *
 *   • un résumé des notes plutôt qu'une simple moyenne, et les avis limités
 *     d'emblée : huit cartes d'avis identiques repoussaient le catalogue hors
 *     de l'écran.
 */
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
  const note = salon.noteMoyenne && salon.nombreAvis
  const depart = prestations.length
    ? Math.min(...prestations.map((p) => Number(p.prix)))
    : null
  const laPlusCourte = prestations.length
    ? [...prestations].sort((a, b) => a.dureeMinutes - b.dureeMinutes)[0]
    : null

  // Regroupement par catégorie, comme sur la fiche d'un vrai salon.
  const groupes = prestations.reduce((acc, p) => {
    const cle = p.categorie || "Prestations"
    ;(acc[cle] ??= []).push(p)
    return acc
  }, {})

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Bandeau                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Couverture salon={salon} hauteur="h-56 sm:h-64">
        {/* Voile sombre en bas : le nom se lit quelle que soit la teinte
            tirée, y compris sur les palettes claires de l'onglerie. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-6">
            {/* Tous les métiers, sans troncature : sur la fiche, la place ne
                manque pas, et c'est l'endroit où l'on vérifie qu'un salon
                fait bien ce qu'on cherche. */}
            <span className="flex flex-wrap gap-1.5">
              {metiersDuSalon(salon).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm"
                >
                  {libelleMetier(m)}
                </span>
              ))}
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              {salon.nom}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
              <span>
                {salon.adresse}
                {salon.quartier && ` · ${salon.quartier}`}
                {salon.ville && ` · ${salon.ville}`}
              </span>
              {note && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 font-semibold text-stone-900">
                  <span className="text-amber-500">★</span>
                  <span className="tabular-nums">
                    {Number(salon.noteMoyenne).toFixed(1).replace(".", ",")}
                  </span>
                  <span className="font-normal text-stone-500">· {salon.nombreAvis} avis</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </Couverture>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          {/* -------------------------------------------------------------- */}
          {/* Colonne principale                                             */}
          {/* -------------------------------------------------------------- */}
          <div className="min-w-0">
            {salon.description && (
              <p className="text-[17px] leading-relaxed text-stone-700">{salon.description}</p>
            )}

            {/*
              Les photos au-delà de la couverture.

              La première est déjà en bandeau : la répéter ici ne montrerait
              rien de plus et donnerait l'impression d'un doublon. Une bande
              qui défile plutôt qu'une grille — deux ou trois photos ne
              remplissent pas une grille, et six ne doivent pas repousser le
              catalogue trois écrans plus bas. C'est le catalogue qu'on vient
              consulter.
            */}
            {salon.photos?.length > 1 && (
              <div className="mt-6 -mx-4 overflow-x-auto px-4 pb-1">
                <ul className="flex gap-3">
                  {salon.photos.slice(1).map((url) => (
                    <li key={url} className="shrink-0">
                      <img
                        src={urlApi(url)}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        /* Une image qui ne vient pas s'efface au lieu de
                           laisser un cadre cassé : la fiche vaut mieux avec
                           une photo de moins qu'avec une icône brisée. */
                        onError={(e) => { e.currentTarget.closest("li").hidden = true }}
                        className="h-36 w-52 rounded-2xl object-cover ring-1 ring-stone-200/70 sm:h-40 sm:w-60"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {employes.length > 0 && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2.5 text-xl font-bold text-stone-900">
                  <EtoileHuit className="h-3 w-3 shrink-0 text-brand-500" />
                  L’équipe
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {employes.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-carte ring-1 ring-stone-200/70"
                    >
                      {/* Les fiches n'ont pas de portrait : une pastille
                          d'initiales vaut mieux qu'un cadre vide. */}
                      <Initiales prenom={e.prenom} nom={e.nom ?? ""} categorie={salon.categorie} />
                      <div>
                        <p className="font-medium text-stone-900">{e.prenom} {e.nom}</p>
                        {e.titre && <p className="text-sm text-stone-500">{e.titre}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10">
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-stone-900">
                <EtoileHuit className="h-3 w-3 shrink-0 text-brand-500" />
                Prestations
              </h2>

              {prestations.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200/70">
                  <p className="font-medium text-stone-900">Catalogue en préparation</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-stone-600">
                    Ce salon vient d’être référencé. Ses prestations arrivent très bientôt.
                  </p>
                </div>
              ) : (
                Object.entries(groupes).map(([categorie, liste]) => (
                  <div key={categorie} className="mt-6">
                    <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-brand-700">
                      {categorie}
                    </h3>
                    <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70">
                      {liste.map((p) => (
                        <li
                          key={p.id}
                          className="group flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-brand-50/40"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">{p.nom}</p>
                            {p.description && (
                              <p className="mt-0.5 text-sm text-stone-500">{p.description}</p>
                            )}
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-stone-400">
                              <Horloge className="h-3.5 w-3.5" />
                              {duree(p.dureeMinutes)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold tabular-nums text-stone-900">
                              {prix(p.prix)}
                            </span>
                            <Link
                              to={`/salon/${salon.id}/reserver?prestationId=${p.id}`}
                              className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-brand-600"
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
              <h2 className="flex items-center gap-2.5 text-xl font-bold text-stone-900">
                <EtoileHuit className="h-3 w-3 shrink-0 text-brand-500" />
                Avis clients
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Déposés par des clients dont le rendez-vous a été honoré.
              </p>
              <div className="mt-4">
                <ListeAvis salonId={salon.id} />
              </div>
            </section>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Panneau de réservation                                         */}
          {/*                                                                */}
          {/* Collant sur grand écran : la décision de réserver se prend en   */}
          {/* lisant le catalogue et les avis, et il ne faut pas remonter la  */}
          {/* page pour agir.                                                */}
          {/* -------------------------------------------------------------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70">
              <div className="p-5">
                {depart != null ? (
                  <>
                    <p className="text-sm text-stone-500">À partir de</p>
                    <p className="mt-0.5 text-3xl font-bold tabular-nums text-stone-900">
                      {prix(depart)}
                    </p>
                    {laPlusCourte && (
                      <p className="mt-1 text-sm text-stone-500">
                        {laPlusCourte.nom} · {duree(laPlusCourte.dureeMinutes)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-stone-600">Catalogue en préparation.</p>
                )}

                <Link
                  to={`/salon/${salon.id}/reserver`}
                  className="mt-5 block rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Voir les disponibilités
                </Link>

                <p className="mt-3 text-center text-xs text-stone-500">
                  Réservation gratuite · Règlement sur place
                </p>
              </div>

              <dl className="space-y-2.5 border-t border-stone-100 bg-stone-50/60 p-5 text-sm">
                <div className="flex items-start gap-2.5">
                  <Etiquette className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div>
                    <dt className="font-medium text-stone-800">Annulation</dt>
                    <dd className="text-stone-600">
                      Libre jusqu’à {salon.delaiAnnulationHeures ?? 24} h avant le rendez-vous
                    </dd>
                  </div>
                </div>
                {salon.telephone && (
                  <div className="flex items-start gap-2.5">
                    <Horloge className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <div>
                      <dt className="font-medium text-stone-800">Une question ?</dt>
                      <dd className="text-stone-600">
                        <a href={`tel:${salon.telephone}`} className="hover:underline">
                          {telephone(salon.telephone)}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Barre d'action, téléphone seulement                              */}
      {/*                                                                  */}
      {/* Sur mobile la grille s'empile, et le panneau de réservation se    */}
      {/* retrouve après les avis : plusieurs écrans de défilement avant de */}
      {/* trouver le bouton. Cette barre le garde à portée de pouce, ce qui */}
      {/* est la façon dont ces pages se consultent réellement.             */}
      {/* pb-safe : sur iPhone, la barre système mange le bas de l'écran.   */}
      {/* ---------------------------------------------------------------- */}
      <div className="sticky bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {depart != null ? (
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-stone-400">À partir de</p>
              <p className="text-lg font-bold tabular-nums leading-tight text-stone-900">
                {prix(depart)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Catalogue en préparation</p>
          )}
          <Link
            to={`/salon/${salon.id}/reserver`}
            className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Voir les disponibilités
          </Link>
        </div>
      </div>
    </div>
  )
}
