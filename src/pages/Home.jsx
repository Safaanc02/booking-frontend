import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import { NoteResume } from "../components/Etoiles"
import { TrameZellige, EtoileHuit } from "../components/Motifs"
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
const METIERS = [
  { cle: "coiffure",   libelle: "Coiffure",     detail: "Coupe, couleur, coiffage" },
  { cle: "barbier",    libelle: "Barbier",      detail: "Coupe homme, barbe" },
  { cle: "onglerie",   libelle: "Onglerie",     detail: "Manucure, pose" },
  { cle: "esthetique", libelle: "Esthétique",   detail: "Soins, épilation" },
  { cle: "hammam",     libelle: "Hammam & spa", detail: "Gommage, massage" },
]

const GLYPHES = {
  coiffure: Coiffure, barbier: Barbier, onglerie: Onglerie,
  esthetique: Esthetique, hammam: Hammam,
  horloge: Horloge, etiquette: Etiquette, rappel: Rappel,
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
 * Elle disparaît en silence si quoi que ce soit manque : un salon sans
 * catalogue, un agenda plein, un serveur muet. Mieux vaut une colonne vide
 * qu'un encadré d'erreur sur une page d'accueil.
 */
function ApercuCreneaux({ salon }) {
  const [apercu, setApercu] = useState(null)

  useEffect(() => {
    if (!salon) return
    let vivant = true

    ;(async () => {
      try {
        const fiche = await publicApi.ficheSalon(salon.id)
        // La plus courte fait le meilleur ambassadeur : elle a plus de
        // créneaux libres à montrer qu'un balayage de deux heures, et un tarif
        // d'entrée est plus parlant qu'un tarif de couleur.
        const prestation = [...(fiche.prestations ?? [])]
          .sort((a, b) => (a.dureeMinutes ?? 0) - (b.dureeMinutes ?? 0))[0]
        if (!prestation) return

        const jours = await publicApi.prochainesDispos(salon.id,
          { prestationId: prestation.id, jours: 14 })
        if (!jours?.length) return

        const dispos = await publicApi.disponibilites(salon.id,
          { prestationId: prestation.id, date: jours[0] })
        const creneaux = (dispos.creneaux ?? []).slice(0, 8)
        if (!creneaux.length) return

        if (vivant) setApercu({ prestation, date: jours[0], creneaux })
      } catch {
        // Aperçu indisponible : la colonne reste au motif seul.
      }
    })()

    return () => { vivant = false }
  }, [salon])

  if (!salon || !apercu) return null

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand-900/10 ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            Libre en ce moment
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-stone-900">{salon.nom}</h3>
          <p className="truncate text-sm text-stone-500">
            {salon.quartier ? `${salon.quartier}, ` : ""}{salon.ville}
          </p>
        </div>
        <NoteResume moyenne={salon.noteMoyenne} nombre={salon.nombreAvis} classe="shrink-0" />
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-stone-100 pt-4">
        <span className="truncate text-sm font-medium text-stone-800">
          {apercu.prestation.nom}
        </span>
        <span className="shrink-0 text-sm text-stone-500">
          {duree(apercu.prestation.dureeMinutes)} · {prix(apercu.prestation.prix)}
        </span>
      </div>

      <p className="mt-4 text-xs font-medium text-stone-400">{jourLong(apercu.date)}</p>
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
    </div>
  )
}

export default function Home() {
  const [reseau, setReseau] = useState({ salons: [], villes: [], total: 0, complet: false })

  useEffect(() => {
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
        })
      })
      .catch(() => {})
    return () => { vivant = false }
  }, [])

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
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-brand-50/40 to-stone-50">
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
              to={`/recherche?q=${encodeURIComponent(libelle)}`}
              className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5 hover:ring-brand-300"
            >
              {/* Le motif n'apparaît qu'au survol : la grille reste calme au
                  repos, et le geste est récompensé. */}
              <TrameZellige
                id={`trame-${cle}`}
                taille={40}
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 text-brand-400 opacity-0 transition-opacity duration-300 group-hover:opacity-60"
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
      {/* ---------------------------------------------------------------- */}
      {reseau.villes.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <TitreSection
            titre="Où nous sommes"
            complement="Le réseau s’étend ville par ville, salon par salon."
          />
          <div className="mt-5 flex flex-wrap gap-2.5">
            {reseau.villes.map((ville) => (
              <Link
                key={ville}
                to={`/recherche?ville=${encodeURIComponent(ville)}`}
                className="group inline-flex items-baseline gap-2 rounded-full bg-white px-4 py-2.5 text-sm ring-1 ring-stone-200 transition hover:bg-brand-600 hover:ring-brand-600"
              >
                <span className="font-medium text-stone-800 group-hover:text-white">{ville}</span>
                {reseau.complet && (
                  <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-stone-500 group-hover:bg-brand-700 group-hover:text-brand-100">
                    {parVille(ville)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Salons mis en avant                                              */}
      {/* ---------------------------------------------------------------- */}
      {mieuxNotes.length >= 2 && (
        <section className="mx-auto max-w-6xl px-4 pb-14">
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
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-px overflow-hidden rounded-3xl bg-stone-200 sm:grid-cols-3">
          {PROMESSES.map(({ glyphe, titre, texte }) => {
            const Glyphe = GLYPHES[glyphe]
            return (
              <div key={titre} className="bg-white p-7">
                <Glyphe className="h-6 w-6 text-brand-600" />
                <p className="mt-4 font-semibold text-stone-900">{titre}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{texte}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Adresse aux professionnels                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="px-4 pb-16">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-700 px-8 py-12 sm:px-12">
          <TrameZellige
            id="trame-pro"
            taille={72}
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
