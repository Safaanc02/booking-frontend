import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import { NoteResume } from "../components/Etoiles"
import {
  Coiffure, Barbier, Onglerie, Esthetique, Hammam,
  Horloge, Etiquette, Rappel,
} from "../components/Glyphes"
import { prix, duree, jourLong, heureLocale } from "../lib/format"
import { OUVERTURE, heureCasablanca, minuteCasablanca, aujourdhui } from "../lib/maroc"
import { useAuth } from "../auth/useAuth"
import { sessionConnue } from "../auth/sessionConnue"
import Tableau from "./Tableau"
import Loader from "../components/Loader"

export default function Accueil() {
  const { ready, authenticated } = useAuth()
  if (ready) return authenticated ? <Tableau /> : <Vitrine />
  return sessionConnue() ? <Loader label="Votre tableau de bord…" /> : <Vitrine />
}

function Vitrine() {
  const [reseau, setReseau] = useState({
    salons: [], villes: [], total: 0, complet: false, erreur: false,
  })

  /**
   * Le réseau, et l'échec dit à haute voix.
   *
   * L'erreur était avalée par un catch vide. Conséquence : une API
   * injoignable donnait exactement la même page qu'un réseau sans aucun
   * salon — mêmes sections, sans le décompte ni le salon mis en avant, et
   * sans un mot. Impossible de distinguer une panne d'un catalogue vide,
   * jusqu'à me demander où était passé le salon.
   *
   * Le silence reste le bon choix pour « ce salon n'a pas de créneau libre ».
   * Il ne l'est pas pour « le serveur ne répond pas ».
   */
  const charger = useCallback(() => {
    setReseau((etat) => ({ ...etat, erreur: false }))
    let vivant = true
    Promise.all([publicApi.rechercherSalons({ size: 50 }), publicApi.villes()])
      .then(([page, villes]) => {
        if (!vivant) return
        const salons = page.content ?? []
        setReseau({
          salons,
          villes: villes ?? [],
          total: page.totalElements ?? salons.length,
          // Les compteurs par ville ne sont exacts que si la page couvre tout
          // le réseau. Au-delà, on affiche les villes sans les dénombrer plutôt
          // qu'un chiffre faux.
          complet: (page.totalElements ?? 0) <= salons.length,
          erreur: false,
        })
      })
      .catch(() => {
        if (vivant) setReseau({ salons: [], villes: [], total: 0, complet: false, erreur: true })
      })
    return () => { vivant = false }
  }, [])

  useEffect(charger, [charger])

  const mieuxNotes = [...reseau.salons]
    .filter((s) => s.noteMoyenne && s.nombreAvis)
    .sort((a, b) => b.noteMoyenne - a.noteMoyenne)
    .slice(0, 3)

  const parVille = (ville) => reseau.salons.filter((s) => s.ville === ville).length

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Bandeau d'entrée                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-brand-50/40 to-ivoire">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-14 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:gap-14 lg:pb-14 lg:pt-20">
          <div>
            <Accroche />

            {/* Le titre suit l'heure du Maroc : le matin promet la journée, le
                soir promet demain. Et il respire sous le curseur. */}
            <TitreVivant />
            <div className="mt-8 max-w-2xl">
              <SearchBar variante="hero" villes={reseau.villes} />
            </div>

            {/* La panne se dit là où le décompte s'affiche : c'est l'endroit
                que l'œil cherche pour savoir si le réseau a répondu. Discret,
                parce que le reste de la page — titre, recherche — fonctionne. */}
            {reseau.erreur && (
              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
                <span>Les salons n’ont pas pu être chargés.</span>
                <button
                  type="button"
                  onClick={charger}
                  className="font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Réessayer
                </button>
              </p>
            )}

            {/* Les compteurs n'apparaissent qu'à partir de dix salons : « 4
                salons dans 3 villes » disait à un gérant qu'il serait le
                cinquième. En dessous, on nomme les villes, on ne compte pas. */}
            {reseau.total > 0 && (
              <p className="mt-5 text-sm text-stone-500">
                {reseau.total >= 10 ? (
                  <>
                    <strong className="font-semibold text-stone-900">{reseau.total}</strong> salons dans{" "}
                    <strong className="font-semibold text-stone-900">{reseau.villes.length}</strong>
                    {reseau.villes.length > 1 ? " villes" : " ville"}
                  </>
                ) : (
                  <>Présents à <strong className="font-semibold text-stone-900">{reseau.villes.join(", ")}</strong></>
                )}
                <span aria-hidden className="mx-3 inline-block h-3 w-px translate-y-px bg-stone-300" />
                Gratuit, sans compte pour chercher
              </p>
            )}
          </div>

          <div className="lg:pl-4">
            <RubanDuJour villes={reseau.villes} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Métiers                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-12">
        <TitreSection
          titre="Par métier"
          complement="Cinq familles de prestations, du hammam à la couleur."
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {METIERS.map(({ cle, libelle, detail }) => {
            const Glyphe = GLYPHES[cle]
            return (
              <Link
                key={cle}
                /* ?metier= et non ?q= : le lien filtre par catégorie, côté
                   serveur. La recherche textuelle tombait juste par
                   coïncidence de vocabulaire, et « Hammam & spa » ne
                   correspondait à rien. */
                to={`/recherche?metier=${cle}`}
                className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5 hover:ring-brand-300"
              >
                {/* Le motif n'apparaît qu'au survol : la grille reste calme au
                    repos, et le geste est récompensé. */}
                <Glyphe className="relative h-8 w-8 text-brand-600 transition-transform duration-300 group-hover:scale-110" />
                <p className="relative mt-4 font-semibold text-stone-900">{libelle}</p>
                <p className="relative mt-0.5 text-xs text-stone-500">{detail}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Villes couvertes                                                 */}
      {/*                                                                  */}
      {/* Sur une bande sable, et en grand. Toute la page se déroulait sur  */}
      {/* le même ivoire : sans alternance de surfaces, les sections se     */}
      {/* succèdent sans qu'on sente où l'une finit. Les villes s'écrivent  */}
      {/* dans la police d'affichage — ce sont des noms de lieux, pas des    */}
      {/* étiquettes de filtre.                                             */}
      {/* ---------------------------------------------------------------- */}
      {reseau.villes.length > 0 && (
        <section className="relative isolate overflow-hidden border-y border-aube-200/60 bg-aube-50">
          <div className="relative mx-auto max-w-6xl px-4 py-14">
            <TitreSection
              titre="Où nous sommes"
              complement="Le réseau s’étend ville par ville, salon par salon."
            />
            <ul className="mt-7 flex flex-wrap items-baseline gap-x-8 gap-y-4 sm:gap-x-12">
              {reseau.villes.map((ville) => (
                <li key={ville}>
                  <Link
                    to={`/recherche?ville=${encodeURIComponent(ville)}`}
                    className="group inline-flex items-baseline gap-2"
                  >
                    <span className="font-titre text-2xl font-semibold text-stone-900 decoration-aube-600 decoration-2 underline-offset-[6px] transition group-hover:text-aube-800 group-hover:underline sm:text-3xl">
                      {ville}
                    </span>
                    {reseau.complet && parVille(ville) >= 5 && (
                      <span className="text-sm tabular-nums text-stone-400 transition group-hover:text-aube-700">
                        {parVille(ville)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Salons mis en avant                                              */}
      {/* ---------------------------------------------------------------- */}
      {mieuxNotes.length >= 2 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <TitreSection
            titre="Les mieux notés"
            complement="Notes déposées par des clients dont le rendez-vous a été honoré."
            lien="/recherche"
            libelleLien="Voir tous les salons"
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mieuxNotes.map((s) => <SalonCard key={s.id} salon={s} />)}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Ce que ça change                                                 */}
      {/*                                                                  */}
      {/* Les pictogrammes sont posés dans une petite arche teintée : trois */}
      {/* traits nus sur du blanc ne retenaient pas l'œil, et la forme      */}
      {/* rappelle la colonnade des métiers plus haut.                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-vigne-200 bg-vigne-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {PROMESSES.map(({ glyphe, titre, texte }) => {
              const Glyphe = GLYPHES[glyphe]
              return (
                <div key={titre}>
                  <div
                    className="relative isolate grid h-12 w-12 place-items-center rounded-full"
                    /* Prune vers framboise : les deux crans de la marque qui portent le
     blanc. Écrit ici plutôt qu'en classes parce qu'un dégradé à deux
     arrêts précis ne se dit pas en utilitaires sans les empiler. */
                    style={{ background: "linear-gradient(150deg, #852e4e, #dc586d)" }}
                  >
                    <Glyphe className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-4 font-titre text-lg font-semibold text-stone-900">{titre}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{texte}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Adresse aux professionnels                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="px-4 pb-16">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-700 px-8 py-12 sm:px-12">
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">
              Vous gérez un salon
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Nous installons votre agenda. Vous gardez la main.
            </h2>
            <p className="mt-4 text-brand-100">
              Prestations, équipe, horaires : notre équipe paramètre tout avec vous.
              Abonnement fixe, <strong className="font-semibold text-white">aucune
              commission</strong> sur vos rendez-vous.
            </p>
            <Link
              to="/professionnels"
              className="mt-7 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
            >
              Demander une démonstration
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
