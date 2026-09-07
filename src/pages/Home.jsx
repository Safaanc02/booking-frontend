import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import { NoteResume } from "../components/Etoiles"
import { TrameZellige, EtoileHuit } from "../components/Motifs"
import Arche from "../components/Arche"
import {
  Coiffure, Barbier, Onglerie, Esthetique, Hammam,
  Horloge, Etiquette, Rappel,
} from "../components/Glyphes"
import { ZONE, prix, duree, jourLong, heureLocale } from "../lib/format"

/** Amplitude d'ouverture courante des salons du réseau, en heures locales. */
const OUVERTURE = [9, 19]

/**
 * Les cinq familles de prestations.
 *
 * Le pictogramme est désigné par une clé et non par le composant lui-même :
 * la règle no-unused-vars du projet ne suit pas les identifiants employés en
 * JSX, et un composant rangé dans un tableau passerait pour inutilisé.
 */
/**
 * Les cinq familles de prestations.
 *
 * Le détail cite ce qu'on y fait vraiment — beldi, rhassoul, henné — plutôt
 * qu'un vocabulaire de catalogue générique.
 */
const METIERS = [
  { cle: "COIFFURE",   libelle: "Coiffure",     detail: "Coupe, couleur, coiffage" },
  { cle: "BARBIER",    libelle: "Barbier",      detail: "Coupe homme, barbe" },
  { cle: "ONGLERIE",   libelle: "Onglerie",     detail: "Manucure, henné" },
  { cle: "ESTHETIQUE", libelle: "Esthétique",   detail: "Soins, épilation" },
  { cle: "SPA",        libelle: "Hammam & spa", detail: "Beldi, gommage, rhassoul" },
]

const GLYPHES = {
  COIFFURE: Coiffure, BARBIER: Barbier, ONGLERIE: Onglerie,
  ESTHETIQUE: Esthetique, SPA: Hammam,
  horloge: Horloge, etiquette: Etiquette, rappel: Rappel,
}

/**
 * Dégradés des tuiles de métier.
 *
 * Mêmes teintes que l'identité des salons : un visiteur qui clique sur la
 * tuile bordeaux « Coiffure » retrouve des cartes bordeaux dans les
 * résultats. La cohérence n'est pas décorative, elle confirme le geste.
 */
const DEGRADES = {
  COIFFURE: "linear-gradient(150deg, #6f2837, #c2566a)",
  BARBIER: "linear-gradient(150deg, #1c1917, #57534e)",
  ONGLERIE: "linear-gradient(150deg, #7d2d4a, #d98693)",
  ESTHETIQUE: "linear-gradient(150deg, #326358, #6fa79a)",
  SPA: "linear-gradient(150deg, #6d3a20, #c08552)",
}

/** Ce que la réservation en ligne change, du point de vue du client. */
const PROMESSES = [
  { glyphe: "horloge", titre: "À toute heure",
    texte: "Le salon dort, son agenda non. Vous réservez à minuit comme à midi." },
  { glyphe: "etiquette", titre: "Prix affichés",
    texte: "Durée et tarif de chaque prestation, avant de choisir votre créneau." },
  { glyphe: "rappel", titre: "Rappel la veille",
    texte: "Un message avant le rendez-vous, et un lien pour annuler si besoin." },
]

/**
 * L'heure de Casablanca, en nombre.
 *
 * Par formatToParts et non par format : en français, `format` rend l'heure
 * seule sous la forme « 01 h ». Number() en tirait NaN, toute comparaison
 * devenait fausse, et la page annonçait des salons ouverts à deux heures du
 * matin — exactement le contraire de ce qu'elle est censée démontrer.
 */
const heureCasablanca = () => Number(
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false, timeZone: ZONE })
    .formatToParts(new Date())
    .find((part) => part.type === "hour")?.value)

const minuteCasablanca = () =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })
    .format(new Date())

/**
 * Bandeau d'accroche, réglé sur l'heure de Casablanca.
 *
 * La promesse du produit est de pouvoir réserver quand le salon ne peut pas
 * répondre. L'énoncer en général n'engage à rien ; l'énoncer à deux heures du
 * matin, avec l'heure affichée, la démontre. Le fuseau est celui de
 * l'application, pas celui du visiteur : un Marocain en voyage réserve à
 * l'heure de son salon.
 */
function Accroche() {
  const [maintenant, setMaintenant] = useState(() => ({
    heure: minuteCasablanca(), h: heureCasablanca(),
  }))

  useEffect(() => {
    // La minute suffit : rafraîchir plus souvent ne change rien à l'écran.
    const id = setInterval(
      () => setMaintenant({ heure: minuteCasablanca(), h: heureCasablanca() }), 30_000)
    return () => clearInterval(id)
  }, [])

  const ferme = maintenant.h < OUVERTURE[0] || maintenant.h >= OUVERTURE[1]

  return (
    <p className="inline-flex items-center gap-2.5 rounded-full bg-white/70 py-1.5 pl-2.5 pr-4 text-[13px] text-stone-600 ring-1 ring-stone-200/80 backdrop-blur">
      <Horloge className="h-4 w-4 shrink-0 text-brand-600" />
      <span>
        <span className="font-semibold tabular-nums text-stone-900">{maintenant.heure}</span>
        {" à Casablanca — "}
        {ferme ? "les salons sont fermés, la réservation non." : "réservez sans décrocher."}
      </span>
    </p>
  )
}

/** Titre de section, ponctué du khatem plutôt que d'un filet. */
function TitreSection({ titre, complement, lien, libelleLien }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-stone-900">
          <EtoileHuit className="h-3 w-3 shrink-0 text-brand-500" />
          {titre}
        </h2>
        {complement && <p className="mt-1 text-sm text-stone-500">{complement}</p>}
      </div>
      {lien && (
        <Link to={lien} className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
          {libelleLien}
        </Link>
      )}
    </div>
  )
}

/**
 * Aperçu de disponibilités réelles, sur un salon réel.
 *
 * Une illustration inventée dirait la même chose sans rien prouver. Celle-ci
 * interroge le moteur de disponibilité du produit, sur le salon le mieux noté :
 * les heures affichées sont libres, et le bouton mène au tunnel. Le prix de la
 * chaîne d'appels est assumé — c'est le seul endroit du site où la promesse est
 * vérifiable d'un coup d'œil.
 *
 * Elle se construisait en trois appels enchaînés — la fiche du salon, les
 * jours ouverts, puis les créneaux du premier jour — et rendait `null` tant
 * que les trois n'avaient pas abouti. La colonne n'existait donc pas pendant
 * trois allers-retours, puis surgissait. À travers un tunnel, où chaque appel
 * quitte le réseau local, l'attente se voit.
 *
 * Elle disparaissait en outre sans un mot dans cinq cas : pas de salon en
 * vedette, salon sans catalogue, aucun jour ouvert sur quinze, jour retenu
 * sans créneau, appel en échec. Chacun rendait exactement la même page qu'un
 * site où cette carte n'existerait pas — impossible de distinguer une panne
 * d'un agenda plein, jusqu'à demander deux fois où elle était passée.
 *
 * Trois règles depuis :
 *
 *   1. la place est réservée dès le premier affichage, par un squelette à sa
 *      forme — rien ne surgit, rien ne paraît manquer ;
 *   2. dès qu'un salon est en vedette, la carte reste, avec ce qu'on sait de
 *      lui : son nom, son quartier, sa note, son tarif d'entrée ;
 *   3. l'absence de créneaux se dit, et se distingue d'un serveur muet — un
 *      agenda plein est une information, une panne en est une autre.
 */
function ApercuCreneaux({ salon }) {
  const [etat, setEtat] = useState({ statut: "chargement", apercu: null, prestation: null })

  useEffect(() => {
    if (!salon) return
    let vivant = true
    setEtat({ statut: "chargement", apercu: null, prestation: null })

    ;(async () => {
      try {
        const fiche = await publicApi.ficheSalon(salon.id)
        // La plus courte fait le meilleur ambassadeur : elle a plus de
        // créneaux libres à montrer qu'un balayage de deux heures, et un tarif
        // d'entrée est plus parlant qu'un tarif de couleur.
        const prestation = [...(fiche.prestations ?? [])]
          .sort((a, b) => (a.dureeMinutes ?? 0) - (b.dureeMinutes ?? 0))[0]
        if (!prestation) {
          if (vivant) setEtat({ statut: "sans-catalogue", apercu: null, prestation: null })
          return
        }

        const jours = await publicApi.prochainesDispos(salon.id,
          { prestationId: prestation.id, jours: 14 })
        if (!jours?.length) {
          if (vivant) setEtat({ statut: "complet", apercu: null, prestation })
          return
        }

        const dispos = await publicApi.disponibilites(salon.id,
          { prestationId: prestation.id, date: jours[0] })
        const creneaux = (dispos.creneaux ?? []).slice(0, 8)
        if (!creneaux.length) {
          if (vivant) setEtat({ statut: "complet", apercu: null, prestation })
          return
        }

        if (vivant) {
          setEtat({ statut: "ok", apercu: { prestation, date: jours[0], creneaux }, prestation })
        }
      } catch {
        // Une panne n'est pas un agenda plein : le salon reste montré, mais la
        // page ne prétend pas savoir s'il a des créneaux.
        if (vivant) setEtat({ statut: "injoignable", apercu: null, prestation: null })
      }
    })()

    return () => { vivant = false }
  }, [salon])

  // Pas encore de salon en vedette : le squelette tient la colonne pour que
  // la mise en page ne saute pas quand il arrive.
  if (!salon) return <SqueletteApercu />
  if (etat.statut === "chargement") return <SqueletteApercu nom={salon.nom} />

  const { apercu } = etat

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand-900/10 ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {apercu ? "Libre en ce moment" : "Salon en vedette"}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-stone-900">{salon.nom}</h3>
          <p className="truncate text-sm text-stone-500">
            {salon.quartier ? `${salon.quartier}, ` : ""}{salon.ville}
          </p>
        </div>
        <NoteResume moyenne={salon.noteMoyenne} nombre={salon.nombreAvis} classe="shrink-0" />
      </div>

      {(apercu?.prestation ?? etat.prestation) && (
        <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-stone-100 pt-4">
          <span className="truncate text-sm font-medium text-stone-800">
            {(apercu?.prestation ?? etat.prestation).nom}
          </span>
          <span className="shrink-0 text-sm text-stone-500">
            {duree((apercu?.prestation ?? etat.prestation).dureeMinutes)}
            {" · "}{prix((apercu?.prestation ?? etat.prestation).prix)}
          </span>
        </div>
      )}

      {/*
        Pas de créneau à montrer : la carte le dit, et dit laquelle des trois
        raisons. « Complet » invite à ouvrir la fiche, où les jours suivants
        sont visibles ; « injoignable » invite à réessayer ; un catalogue vide
        annonce un salon qu'on finit d'installer. Trois phrases, parce que
        trois gestes différents.
      */}
      {!apercu && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="text-sm text-stone-600">
            {etat.statut === "complet"
              ? "Aucun créneau libre sur les quinze prochains jours. La fiche montre les suivants."
              : etat.statut === "sans-catalogue"
                ? "Les prestations de ce salon sont en cours d’installation."
                : "Les créneaux n’ont pas pu être chargés."}
          </p>
          <Link
            to={`/salon/${salon.id}`}
            className="mt-4 block rounded-xl bg-stone-900 py-3 text-center text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Voir {salon.nom}
          </Link>
        </div>
      )}

      {apercu && (
      <>
      <p className="mt-4 text-sm font-medium text-stone-700">{jourLong(apercu.date)}</p>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {apercu.creneaux.map((c) => (
          <Link
            key={c.debut}
            to={`/salon/${salon.id}/reserver?prestationId=${apercu.prestation.id}`}
            className="rounded-xl bg-stone-50 py-2 text-center text-sm font-medium tabular-nums text-stone-700 ring-1 ring-stone-200 transition hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-300"
          >
            {heureLocale(c.debut)}
          </Link>
        ))}
      </div>

      <Link
        to={`/salon/${salon.id}/reserver?prestationId=${apercu.prestation.id}`}
        className="mt-5 block rounded-xl bg-stone-900 py-3 text-center text-sm font-semibold text-white transition hover:bg-stone-800"
      >
        Réserver chez {salon.nom}
      </Link>
      </>
      )}
    </div>
  )
}

/**
 * Squelette de la carte, à sa forme et à sa hauteur.
 *
 * Il ne sert pas à faire patienter : il empêche la colonne de ne pas exister.
 * Sans lui, la mise en page vivait trois allers-retours sans sa moitié droite,
 * puis sautait — et pendant ce temps la page était indistinguable d'une page
 * dont on aurait retiré la carte.
 */
function SqueletteApercu({ nom }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand-900/10 ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-28 animate-pulse rounded bg-brand-100" />
          {nom ? (
            <h3 className="mt-2 truncate text-lg font-bold text-stone-900">{nom}</h3>
          ) : (
            <div className="mt-2 h-5 w-40 animate-pulse rounded bg-stone-200/80" />
          )}
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-stone-100" />
        </div>
        <div className="h-5 w-16 shrink-0 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-stone-100 pt-4">
        <div className="h-4 w-24 animate-pulse rounded bg-stone-200/70" />
        <div className="h-4 w-28 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="mt-4 h-4 w-36 animate-pulse rounded bg-stone-100" />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-xl bg-stone-100" />
        ))}
      </div>
      <div className="mt-5 h-11 animate-pulse rounded-xl bg-stone-200/70" />
    </div>
  )
}

export default function Home() {
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

  const vedette = mieuxNotes[0] ?? reseau.salons[0]
  const parVille = (ville) => reseau.salons.filter((s) => s.ville === ville).length

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Bandeau d'entrée                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-brand-50/40 to-ivoire">
        {/* Le motif habille les marges hautes et s'efface avant d'atteindre le
            titre : une trame sous un texte de cette taille se lit comme du
            bruit, et c'est le titre qui doit gagner. */}
        <TrameZellige
          id="trame-accueil"
          className="pointer-events-none absolute inset-0 h-full w-full text-brand-500/30"
          style={{
            maskImage: "radial-gradient(90% 55% at 50% -10%, #000 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(90% 55% at 50% -10%, #000 0%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-14 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:gap-14 lg:pb-14 lg:pt-20">
          <div>
            <Accroche />

            {/* whitespace-nowrap sur « rendez-vous » : sans lui, la césure
                tombait sur le trait d'union et coupait le mot en deux lignes,
                au beau milieu du titre. */}
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
              Votre prochain <span className="whitespace-nowrap">rendez-vous</span>,
              <span className="block text-brand-700">sans un seul appel.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-stone-600">
              Coiffure, barbier, onglerie, hammam. Comparez les prix, choisissez
              votre praticien, prenez le créneau qui vous arrange — et changez
              d’avis jusqu’à la veille.
            </p>

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

            {reseau.total > 0 && (
              <p className="mt-5 text-sm text-stone-500">
                <strong className="font-semibold text-stone-900">{reseau.total}</strong>
                {reseau.total > 1 ? " salons" : " salon"} dans{" "}
                <strong className="font-semibold text-stone-900">{reseau.villes.length}</strong>
                {reseau.villes.length > 1 ? " villes" : " ville"}
                <span aria-hidden className="mx-3 inline-block h-3 w-px translate-y-px bg-stone-300" />
                Gratuit, sans compte pour chercher
              </p>
            )}
          </div>

          <div className="lg:pl-4">
            <ApercuCreneaux salon={vedette} />
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
                <TrameZellige
                  id={`trame-${cle}`}
                  taille={92}
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 text-brand-400 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
                />
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
        <section className="relative isolate overflow-hidden border-y border-majorelle-200/60 bg-majorelle-50">
          <TrameZellige
            id="trame-villes"
            taille={120}
            className="pointer-events-none absolute inset-0 h-full w-full text-majorelle-600/[0.09]"
          />
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
                    <span className="font-titre text-2xl font-semibold text-stone-900 decoration-majorelle-500 decoration-2 underline-offset-[6px] transition group-hover:text-majorelle-700 group-hover:underline sm:text-3xl">
                      {ville}
                    </span>
                    {reseau.complet && (
                      <span className="text-sm tabular-nums text-stone-400 transition group-hover:text-majorelle-600">
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
      <section className="border-y border-safran-100 bg-safran-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {PROMESSES.map(({ glyphe, titre, texte }) => {
              const Glyphe = GLYPHES[glyphe]
              return (
                <div key={titre}>
                  <div className="relative isolate h-14 w-11">
                    <Arche
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(150deg, #8f6015, #d99a2b)" }}
                    />
                    <Glyphe className="absolute left-1/2 top-[42%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white" />
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
          <TrameZellige
            id="trame-pro"
            taille={132}
            className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
            style={{
              maskImage: "radial-gradient(90% 120% at 100% 50%, #000 10%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(90% 120% at 100% 50%, #000 10%, transparent 65%)",
            }}
          />
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
