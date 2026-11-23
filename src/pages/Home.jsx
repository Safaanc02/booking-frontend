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
        <h2 className="text-xl font-bold tracking-tight text-stone-900">
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

/*
 * Le titre qui vit la journée.
 *
 * « Votre prochain rendez-vous, sans un seul appel » restait vrai à toute
 * heure, et c'était sa faiblesse : une phrase vraie à toute heure n'en dit
 * aucune. Le matin, le site parle de la journée qui commence ; l'après-midi,
 * de l'après-midi ; le soir, de demain. Il suit l'heure de Casablanca, pas
 * celle du visiteur.
 *
 * Et il respire : la graisse de Fraunces suit le curseur, de très peu. Ce
 * n'est pas un effet, c'est le papier du carnet qui prend la lumière.
 */
function TitreVivant({ jour = null }) {
  const [h, setH] = useState(heureCasablanca)
  const ref = useRef(null)
  useEffect(() => {
    const id = setInterval(() => setH(heureCasablanca()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia("(pointer: fine)").matches) return undefined
    let attendu = false
    const bouge = (e) => {
      if (attendu) return
      attendu = true
      requestAnimationFrame(() => {
        attendu = false
        const r = el.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        el.style.setProperty("--souffle", x.toFixed(2))
      })
    }
    window.addEventListener("mousemove", bouge, { passive: true })
    return () => window.removeEventListener("mousemove", bouge)
  }, [])

  /* Le jour que montre le ruban prime : si le ruban a glissé sur demain ou
     sur jeudi, le titre ne promet pas « cet après-midi ». */
  const moment = h < 12 ? "matin" : h < 18 ? "apres" : "soir"
  const autreJour = jour && jour !== "Aujourd'hui"
  const ligne1 = autreJour ? `${jour}, à l'heure`
    : { matin: "Ce matin, à l'heure", apres: "Cet après-midi, à l'heure", soir: "Demain, à l'heure" }[moment]
  const ligne2 = autreJour ? "que vous voulez."
    : { matin: "qui vous arrange.", apres: "qui vous arrange.", soir: "que vous voulez." }[moment]
  return (
    <>
      <h1 ref={ref} className="respire mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
        {ligne1}
        <span className="block text-brand-700">{ligne2}</span>
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-stone-600">
        Choisissez l'heure d'abord. Le ruban dit qui peut vous recevoir à cet instant —
        coiffure, barbier, onglerie, hammam — et vous réservez en un geste. Sans appel, et
        vous pouvez changer d'avis jusqu'à la veille.
      </p>
    </>
  )
}

const isoPlus = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/*
 * Le ruban de la journée.
 *
 * C'est le renversement de l'accueil. Tous les sites demandent « quel
 * salon ? » puis « quelle heure ? » ; une cliente se demande d'abord « j'ai
 * une heure à 16:30, qui me prend ? ». Le ruban répond : une rangée d'heures,
 * chacune portant le nombre de salons libres à cet instant. L'heure qu'il
 * est bat ; les heures passées sont barrées. On touche une heure, la carte
 * montre qui peut vous recevoir, et « Réserver à 16:30 » mène au tunnel avec
 * l'heure déjà prise.
 *
 * Quel jour : aujourd'hui, sauf après la dernière heure d'ouverture — un
 * ruban entièrement barré est un écran fermé, pas une invitation. Et si le
 * jour n'a aucun créneau (fermeture, férié), le ruban glisse sur le premier
 * des quatre jours suivants qui en a, et le dit. Au-delà, le vide est montré
 * tel quel : c'est alors une vraie information.
 *
 * Les chiffres sont vrais : ils viennent des créneaux réels, à la minute.
 */
function RubanDuJour({ villes, onJour }) {
  const [ville, setVille] = useState("")
  const [h, setH] = useState(heureCasablanca)
  const [m, setM] = useState(minuteCasablanca)
  const [decalage, setDecalage] = useState(0)
  const [etat, setEtat] = useState({ statut: "chargement", data: null })
  const [heure, setHeure] = useState(null)
  const [salons, setSalons] = useState({ statut: "inactif", data: [] })
  const rubanRef = useRef(null)

  const soir = h >= OUVERTURE[1] - 1
  const date = useMemo(() => isoPlus((soir ? 1 : 0) + decalage), [soir, decalage])
  const estAujourdhui = date === aujourdhui()
  const libelleJour = estAujourdhui ? "Aujourd'hui"
    : date === isoPlus(1) ? "Demain"
    : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })
        .format(new Date(`${date}T12:00:00`)).replace(/^./, (c) => c.toUpperCase())

  useEffect(() => {
    const id = setInterval(() => { setH(heureCasablanca()); setM(minuteCasablanca()) }, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let vivant = true
    setEtat({ statut: "chargement", data: null })
    setHeure(null); setSalons({ statut: "inactif", data: [] })
    publicApi.creneauxDuJour({ ville, date })
      .then((data) => {
        if (!vivant) return
        if ((data.heures ?? []).length === 0 && decalage < 4) { setDecalage((n) => n + 1); return }
        setEtat({ statut: "ok", data })
      })
      .catch(() => { if (vivant) setEtat({ statut: "erreur", data: null }) })
    return () => { vivant = false }
  }, [ville, date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onJour?.(libelleJour) }, [libelleJour]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (etat.statut !== "ok" || !rubanRef.current) return
    const courant = rubanRef.current.querySelector('[data-courant="true"]')
    if (courant) courant.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" })
  }, [etat.statut])

  const choisir = (heureChoisie, ids) => {
    setHeure(heureChoisie)
    setSalons({ statut: "chargement", data: [] })
    Promise.all(ids.slice(0, 6).map((id) => publicApi.ficheSalon(id).catch(() => null)))
      .then((fiches) => setSalons({ statut: "ok", data: fiches.filter(Boolean) }))
  }

  const heures = etat.data?.heures ?? []
  const minutesMaintenant = h * 60 + Number(String(m).slice(3, 5) || 0)
  const enMinutes = (hh) => Number(hh.slice(0, 2)) * 60 + Number(hh.slice(3, 5))
  const estPassee = (hh) => estAujourdhui && enMinutes(hh) < minutesMaintenant
  const total = heures.reduce((n, x) => n + (estPassee(x.heure.slice(0, 5)) ? 0 : x.salons.length), 0)

  return (
    <div className="rounded-3xl bg-white/80 p-5 shadow-carte ring-1 ring-stone-200/70 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          {libelleJour}{ville ? ` à ${ville}` : ""}
        </p>
        {etat.statut === "ok" && (
          <p className="text-sm text-stone-500">
            <span className="font-semibold tabular-nums text-stone-900">{total}</span> créneau{total > 1 ? "x" : ""} libre{total > 1 ? "s" : ""}{estAujourdhui ? " d'ici ce soir" : ""}
          </p>
        )}
      </div>

      {villes?.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["", ...villes].map((v) => (
            <button key={v || "toutes"} type="button" onClick={() => { setDecalage(0); setVille(v) }} aria-pressed={ville === v}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${ville === v ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
              {v || "Toutes les villes"}
            </button>
          ))}
        </div>
      )}

      <div className="relative mt-4">
        <div ref={rubanRef} className="ruban-jour -mx-1 flex gap-2 overflow-x-auto px-1 py-2">
          {etat.statut === "chargement" && Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-16 w-[72px] shrink-0 animate-pulse rounded-2xl bg-stone-100" />
          ))}
          {etat.statut === "erreur" && <p className="text-sm text-stone-500">Les créneaux n'ont pas pu être chargés.</p>}
          {etat.statut === "ok" && heures.length === 0 && (
            <p className="text-sm text-stone-500">Aucun créneau dans les prochains jours{ville ? ` à ${ville}` : ""}. Essayez une autre ville.</p>
          )}
          {etat.statut === "ok" && heures.map((x) => {
            const hh = x.heure.slice(0, 5)
            const passee = estPassee(hh)
            const courante = estAujourdhui && !passee && enMinutes(hh) - minutesMaintenant < 30
            const actif = heure === hh
            const n = x.salons.length
            return (
              <button
                key={hh}
                type="button"
                data-courant={courante ? "true" : undefined}
                disabled={passee}
                onClick={() => choisir(hh, x.salons)}
                aria-pressed={actif}
                className={`relative flex h-16 w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl text-sm transition ${
                  passee ? "text-stone-300 line-through" :
                  actif ? "bg-brand-600 text-white shadow-carte-levee" :
                  "bg-stone-50 text-stone-800 hover:-translate-y-0.5 hover:bg-brand-50 hover:text-brand-800"
                }`}
              >
                {courante && !actif && <span aria-hidden className="pouls absolute -top-1 right-2 h-2 w-2 rounded-full bg-brand-500" />}
                <span className="heure font-semibold">{hh}</span>
                <span className={`mt-0.5 text-[11px] ${actif ? "text-white/85" : passee ? "" : "text-stone-500"}`}>
                  {passee ? "passé" : `${n} salon${n > 1 ? "s" : ""}`}
                </span>
              </button>
            )
          })}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/90 to-transparent" />
      </div>

      {heure && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-sm text-stone-600">
            Libres à <span className="heure font-semibold text-stone-900">{heure}</span>{estAujourdhui ? "" : ` ${libelleJour.toLowerCase()}`} —
            {salons.statut === "chargement" ? " un instant…" : ` ${salons.data.length} salon${salons.data.length > 1 ? "s" : ""}`}
          </p>
          <ul className="mt-3 grid gap-2">
            {salons.statut === "ok" && salons.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3.5 py-2.5">
                <Link to={`/salon/${s.id}`} className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-900">{s.nom}</span>
                  <span className="block truncate text-xs text-stone-500">{[s.quartier, s.ville].filter(Boolean).join(" · ")}</span>
                </Link>
                <Link
                  to={`/salon/${s.id}/reserver?date=${date}&heure=${heure}`}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Réserver à {heure}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!heure && etat.statut === "ok" && heures.length > 0 && (
        <p className="mt-3 text-xs text-stone-400">Touchez une heure : la page montre qui peut vous recevoir à cet instant.</p>
      )}
    </div>
  )
}

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
  /* Le jour que montre le ruban, pour que le titre parle du même. */
  const [jourRuban, setJourRuban] = useState(null)

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Bandeau d'entrée                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-brand-50/40 to-ivoire">
        {/* grid-cols-[minmax(0,1fr)] à toutes les tailles : sans borne, la piste
            implicite prend la largeur intrinsèque du ruban — tous ses créneaux
            bout à bout, 2 432 px — et le bandeau coupe tout à 390 px. */}
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-12 pt-14 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:gap-14 lg:pb-14 lg:pt-20">
          <div className="min-w-0">
            <Accroche />

            {/* Le titre suit l'heure du Maroc : le matin promet la journée, le
                soir promet demain. Et il respire sous le curseur. */}
            <TitreVivant jour={jourRuban} />
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

          <div className="min-w-0 lg:pl-4">
            <RubanDuJour villes={reseau.villes} onJour={setJourRuban} />
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
