import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { adminApi, proApi, reservationsApi, salonsApi } from "../api/bookingApi"
import { useAuth } from "../auth/useAuth"
import { heureLocale, instantLong, jourLong, prix, telephone } from "../lib/format"
import { aujourdhui, minuteCasablanca, salonsOuverts, salutation } from "../lib/maroc"
import Loader from "../components/Loader"
import { Horloge } from "../components/Glyphes"
import { MarqueFleur } from "../components/Motifs"

/*
 * Le tableau de bord — ce qui remplace la vitrine une fois connecté.
 *
 * La page d'accueil vend le produit : elle explique ce qu'est DarZin, montre
 * des salons, invite à chercher. C'est le bon écran pour qui découvre, et le
 * mauvais pour qui revient — un gérant qui ouvre le site le matin n'a pas
 * besoin qu'on lui présente le service dont il se sert.
 *
 * L'organisation est la même pour les trois rôles : ce qui attend d'abord, en
 * grand, puis le reste. Ce qui change, c'est la nature de l'attente — un
 * rendez-vous pour la cliente, la journée pour le gérant, la file pour
 * l'équipe.
 */

/* Les statuts qui comptent comme un rendez-vous encore à honorer. */
const VIVANTS = new Set(["EN_ATTENTE", "CONFIRMEE"])

const BADGES = {
  EN_ATTENTE:     ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMEE:      ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  HONOREE:        ["Honorée", "bg-sky-50 text-sky-700 ring-sky-200"],
  ANNULEE_CLIENT: ["Annulée", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON:  ["Annulée par le salon", "bg-stone-100 text-stone-500 ring-stone-200"],
  ABSENT:         ["Absence", "bg-red-50 text-red-700 ring-red-200"],
}

/**
 * « Aujourd'hui », « Demain », sinon la date.
 *
 * Comparé en jours calendaires et non en écart d'heures : un rendez-vous à
 * 8 h demain matin est dans onze heures, et l'appeler « aujourd'hui » parce
 * qu'il tient dans les vingt-quatre prochaines serait faux pour qui le lit.
 */
function quandCourt(iso) {
  const jour = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" })
  const cible = jour(iso)
  const ce = jour(Date.now())
  const demain = jour(Date.now() + 86_400_000)
  if (cible === ce) return "Aujourd'hui"
  if (cible === demain) return "Demain"
  return jourLong(new Date(iso))
}

export default function Tableau() {
  const { user, hasRole } = useAuth()
  const estAdmin = hasRole("admin")
  const estPro = hasRole("pro")

  const [etat, setEtat] = useState({ statut: "chargement", donnees: {}, manquant: [] })

  /*
   * Chaque source est chargée pour elle-même, et son échec nommé.
   *
   * Un `catch` global aurait remplacé tout l'écran par une erreur : le jour où
   * seule la file commerciale tombe, le gérant perdrait aussi ses rendez-vous
   * du jour, qui eux répondaient très bien. À l'inverse, un `catch` vide par
   * source aurait rendu une panne indiscernable d'une journée creuse.
   */
  const charger = useCallback(() => {
    setEtat((e) => ({ ...e, statut: e.statut === "ok" ? "ok" : "chargement" }))

    const sources = [["reservations", () => reservationsApi.mesReservations()]]
    if (estPro) sources.push(
      ["salons", () => salonsApi.mesSalons()],
      ["journee", () => proApi.maJournee(aujourdhui())])
    if (estAdmin) sources.push(
      ["plateforme", () => adminApi.tableauDeBord(30)],
      ["demandes", () => adminApi.nouvellesDemandes()])

    let vivant = true
    Promise.allSettled(sources.map(([, appel]) => appel())).then((issues) => {
      if (!vivant) return
      const donnees = {}
      const manquant = []
      issues.forEach((issue, i) => {
        const [nom] = sources[i]
        if (issue.status === "fulfilled") donnees[nom] = issue.value
        else manquant.push(nom)
      })
      setEtat({ statut: "ok", donnees, manquant })
    })
    return () => { vivant = false }
  }, [estPro, estAdmin])

  useEffect(charger, [charger])

  const { reservations = [], salons = [], journee = [], plateforme, demandes = [] } = etat.donnees

  /* Les rendez-vous à venir de la personne connectée, du plus proche au plus loin. */
  const aVenir = useMemo(() => {
    const maintenant = Date.now()
    return reservations
      .filter((r) => VIVANTS.has(r.statut) && new Date(r.debut) >= maintenant)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut))
  }, [reservations])

  /* Les visites honorées qui attendent encore un avis. */
  const avisAttendus = useMemo(
    () => reservations.filter((r) => r.statut === "HONOREE" && !r.avisDepose),
    [reservations])

  /* La journée du gérant, ce qu'il en reste. */
  const journeeRestante = useMemo(() => {
    const maintenant = Date.now()
    return journee
      .filter((r) => VIVANTS.has(r.statut) && new Date(r.fin) >= maintenant)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut))
  }, [journee])

  if (etat.statut === "chargement") return <Loader label="Votre tableau de bord…" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Salutation prenom={user?.nom?.split(" ")[0] || user?.username} />

      {etat.manquant.length > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {etat.manquant.length === 1
            ? "Une partie de cette page n'a pas pu être chargée"
            : `${etat.manquant.length} parties de cette page n'ont pas pu être chargées`}
          {" ("}{etat.manquant.join(", ")}{"). "}
          <button onClick={charger} className="font-semibold underline">Réessayer</button>
        </p>
      )}

      {/* Un seul grand encart, celui du rôle principal : deux « choses qui
          attendent » côte à côte n'attendent plus, elles se concurrencent. */}
      {estAdmin
        ? <HeroAdmin plateforme={plateforme} demandes={demandes} />
        : estPro
          ? <HeroPro journee={journeeRestante} salons={salons} />
          : <HeroClient rdv={aVenir[0]} />}

      <div className="mt-10 space-y-10">
        {estAdmin && <SectionAdmin plateforme={plateforme} demandes={demandes} />}
        {estPro && <SectionPro journee={journeeRestante} salons={salons} />}
        <SectionClient
          aVenir={estAdmin || estPro ? aVenir : aVenir.slice(1)}
          avisAttendus={avisAttendus}
          historique={reservations}
          seul={!estAdmin && !estPro}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* En-tête                                                            */
/* ------------------------------------------------------------------ */

function Salutation({ prenom }) {
  const [minute, setMinute] = useState(minuteCasablanca)
  useEffect(() => {
    const id = setInterval(() => setMinute(minuteCasablanca()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">
        {salutation()}{prenom ? ` ${prenom}` : ""}
      </h1>
      <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-stone-500">
        <Horloge className="h-4 w-4 shrink-0 text-brand-600" />
        <span>
          <span className="font-semibold tabular-nums text-stone-700">{minute}</span>
          {" à Casablanca — "}
          {salonsOuverts() ? "les salons sont ouverts." : "les salons sont fermés, la réservation non."}
        </span>
      </p>
    </header>
  )
}

/** L'encart principal : un fond sable, pour qu'on le voie avant tout le reste. */
function Encart({ oeil, titre, enfants, actions }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl bg-sable ring-1 ring-stone-200/80">
      <div className="p-6 sm:p-7">
        {oeil && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{oeil}</p>
        )}
        <div className="mt-2">{titre}</div>
        {enfants}
        {actions && <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </section>
  )
}

const Bouton = ({ to, href, children }) => {
  const classes = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
  return to ? <Link to={to} className={classes}>{children}</Link>
            : <a href={href} className={classes}>{children}</a>
}

const Lien = ({ to, children }) => (
  <Link to={to} className="text-sm text-stone-600 underline hover:text-stone-900">{children}</Link>
)

/* ------------------------------------------------------------------ */
/* Cliente                                                            */
/* ------------------------------------------------------------------ */

function HeroClient({ rdv }) {
  if (!rdv) {
    return (
      <Encart
        titre={<p className="text-xl font-semibold text-stone-900">Aucun rendez-vous à venir</p>}
        enfants={
          <p className="mt-2 max-w-md text-sm text-stone-600">
            Coiffure, barbier, onglerie, hammam — comparez les prix, choisissez votre
            praticien, prenez le créneau qui vous arrange.
          </p>}
        actions={<><Bouton to="/recherche">Trouver un salon</Bouton>
                   <Lien to="/compte">Mon historique</Lien></>}
      />
    )
  }

  return (
    <Encart
      oeil={`${quandCourt(rdv.debut)} · ${heureLocale(rdv.debut)}`}
      titre={<p className="text-xl font-semibold text-stone-900">{rdv.prestation}</p>}
      enfants={
        <>
          <p className="mt-1 text-stone-600">
            chez <Link to={`/salon/${rdv.salonId}`} className="font-medium hover:underline">{rdv.salonNom}</Link>
            {rdv.employe && <span className="text-stone-500"> · avec {rdv.employe}</span>}
          </p>
          <p className="mt-3 text-sm text-stone-500">
            {instantLong(rdv.debut)} · <span className="font-semibold text-stone-700">{prix(rdv.prix)}</span>
          </p>
        </>}
      actions={<><Bouton to={`/salon/${rdv.salonId}`}>Voir le salon</Bouton>
                 <Lien to="/compte">Gérer mes rendez-vous</Lien></>}
    />
  )
}

function SectionClient({ aVenir, avisAttendus, historique, seul }) {
  /* Les salons déjà fréquentés, du plus récent au plus ancien, sans doublon. */
  const habitudes = useMemo(() => {
    const vus = new Map()
    ;[...historique]
      .sort((a, b) => new Date(b.debut) - new Date(a.debut))
      .forEach((r) => { if (r.salonId && !vus.has(r.salonId)) vus.set(r.salonId, r.salonNom) })
    return [...vus].slice(0, 4)
  }, [historique])

  /*
   * Trois sections plutôt qu'une, chacune titrée d'après ce qu'elle contient.
   *
   * Réunies sous un seul titre, celui-ci mentait dès que l'une d'elles était
   * vide : « Mes autres rendez-vous » coiffait une liste de salons à
   * recontacter, sans le moindre rendez-vous en dessous.
   */
  return (
    <>
      {avisAttendus.length > 0 && (
        <section>
          <Titre>{avisAttendus.length > 1 ? "Vos avis" : "Votre avis"}</Titre>
          <ul className="space-y-2">
            {avisAttendus.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/compte?avis=${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm ring-1 ring-brand-200 hover:bg-brand-100"
                >
                  <span className="text-brand-900">
                    Donner mon avis sur <span className="font-semibold">{r.prestation}</span> chez {r.salonNom}
                  </span>
                  <span aria-hidden className="text-brand-700">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aVenir.length > 0 && (
        <section>
          <Titre lien="/compte" libelleLien="Tout mon historique">
            {seul ? "Mes autres rendez-vous" : "Mes rendez-vous"}
          </Titre>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {aVenir.slice(0, 5).map((r) => {
              const [libelle, classes] = BADGES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{r.prestation}</p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {quandCourt(r.debut)} &middot; {heureLocale(r.debut)} &middot;{" "}
                      <Link to={`/salon/${r.salonId}`} className="hover:underline">{r.salonNom}</Link>
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>{libelle}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {habitudes.length > 0 && (
        <section>
          <Titre lien="/recherche" libelleLien="Chercher ailleurs">Réserver à nouveau</Titre>
          <div className="flex flex-wrap gap-2">
            {habitudes.map(([id, nom]) => (
              <Link
                key={id}
                to={`/salon/${id}`}
                className="rounded-full bg-white px-4 py-2 text-sm text-stone-700 ring-1 ring-stone-200 hover:ring-brand-300"
              >
                {nom}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Gérant                                                             */
/* ------------------------------------------------------------------ */

function HeroPro({ journee, salons }) {
  const prochain = journee[0]
  const actifs = salons.filter((s) => s.statut === "ACTIF").length
  const attente = salons.filter((s) => s.statut === "EN_ATTENTE").length

  if (!prochain) {
    return (
      <Encart
        oeil="Aujourd'hui"
        titre={<p className="text-xl font-semibold text-stone-900">Plus rien au programme</p>}
        enfants={
          <p className="mt-2 max-w-md text-sm text-stone-600">
            {salons.length === 0
              ? "Aucun salon n'est rattaché à ce compte."
              : `${actifs} salon${actifs > 1 ? "s" : ""} en ligne`}
            {attente > 0 && `, ${attente} en attente de validation`}
            {salons.length > 0 && ". Votre agenda reste ouvert aux réservations."}
          </p>}
        actions={<><Bouton to="/pro">Mes salons</Bouton>
                   <Lien to="/mon-planning">Mon planning</Lien></>}
      />
    )
  }

  return (
    <Encart
      oeil={`Prochain rendez-vous · ${heureLocale(prochain.debut)}`}
      titre={<p className="text-xl font-semibold text-stone-900">{prochain.client}</p>}
      enfants={
        <>
          <p className="mt-1 text-stone-600">
            {prochain.prestation}
            {prochain.employe && <span className="text-stone-500"> · avec {prochain.employe}</span>}
          </p>
          <p className="mt-3 text-sm text-stone-500">
            {prochain.salonNom}
            {prochain.clientTelephone && <> &middot; {telephone(prochain.clientTelephone)}</>}
          </p>
        </>}
      actions={<><Bouton to={`/pro/salon/${prochain.salonId}`}>Ouvrir l'agenda</Bouton>
                 <span className="text-sm text-stone-500">
                   {journee.length > 1
                     ? `${journee.length} rendez-vous restants aujourd'hui`
                     : "seul rendez-vous de la journée"}
                 </span></>}
    />
  )
}

function SectionPro({ journee, salons }) {
  return (
    <>
      {journee.length > 1 && (
        <section>
          <Titre>Le reste de la journée</Titre>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {journee.slice(1, 8).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-baseline gap-4">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                    {heureLocale(r.debut)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{r.client}</p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {r.prestation}
                      {r.employe && ` · ${r.employe}`}
                    </p>
                  </div>
                </div>
                <Link to={`/pro/salon/${r.salonId}`} className="text-sm text-stone-500 hover:underline">
                  {r.salonNom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {salons.length > 0 && (
        <section>
          <Titre lien="/pro" libelleLien="Tous mes salons">Mes salons</Titre>
          <ul className="grid gap-3 sm:grid-cols-2">
            {salons.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link
                  to={`/pro/salon/${s.id}`}
                  className="block rounded-2xl bg-white p-4 ring-1 ring-stone-200 transition hover:ring-brand-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-900">{s.nom}</p>
                      <p className="mt-0.5 truncate text-sm text-stone-500">{s.ville}</p>
                    </div>
                    {s.statut === "EN_ATTENTE" && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        En attente
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Équipe DarZin                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ce qui attend l'équipe, par ordre de ce qui se périme le plus vite.
 *
 * Une demande de démo laissée trois jours est une affaire perdue ; un salon
 * en attente de validation ne perd rien à attendre une heure de plus. D'où
 * l'ordre — et non l'inverse, qui mettrait en avant le chiffre le plus gros.
 */
function fileAdmin(plateforme, demandes) {
  const file = []
  if (demandes.length > 0) {
    file.push({
      cle: "demandes",
      libelle: `${demandes.length} demande${demandes.length > 1 ? "s" : ""} de démo à traiter`,
      urgence: "Un salon vous a écrit et attend une réponse.",
    })
  }
  const attente = plateforme?.reseau?.EN_ATTENTE ?? 0
  if (attente > 0) {
    file.push({
      cle: "salons",
      libelle: `${attente} salon${attente > 1 ? "s" : ""} en attente de validation`,
      urgence: "Ils n'apparaissent pas encore dans la recherche.",
    })
  }
  const dormants = plateforme?.salonsDormants?.length ?? 0
  if (dormants > 0) {
    file.push({
      cle: "dormants",
      libelle: `${dormants} salon${dormants > 1 ? "s" : ""} sans aucune réservation`,
      urgence: "Installés, mais jamais partis. À rappeler.",
    })
  }
  return file
}

function HeroAdmin({ plateforme, demandes }) {
  const file = fileAdmin(plateforme, demandes)
  const premier = file[0]

  if (!premier) {
    return (
      <Encart
        oeil="La plateforme"
        titre={<p className="text-xl font-semibold text-stone-900">Rien n'attend</p>}
        enfants={
          <p className="mt-2 max-w-md text-sm text-stone-600">
            Aucune demande en attente, aucun salon à valider, aucun installé sans
            réservation. Les chiffres des trente derniers jours sont plus bas.
          </p>}
        actions={<Bouton to="/admin">Ouvrir l'administration</Bouton>}
      />
    )
  }

  return (
    <Encart
      oeil="À traiter en premier"
      titre={<p className="text-xl font-semibold text-stone-900">{premier.libelle}</p>}
      enfants={
        <>
          <p className="mt-2 text-sm text-stone-600">{premier.urgence}</p>
          {file.length > 1 && (
            <p className="mt-3 text-sm text-stone-500">
              Puis : {file.slice(1).map((f) => f.libelle).join(", ")}.
            </p>
          )}
        </>}
      actions={<Bouton to="/admin">Ouvrir la file</Bouton>}
    />
  )
}

function SectionAdmin({ plateforme }) {
  if (!plateforme) return null

  const {
    reseau = {}, activite = {}, volumeMad = 0, fileCommerciale = {},
    tauxConversionPourcent, salonsDormants: dormants = [],
  } = plateforme
  const honorees = activite.HONOREE ?? 0
  const annulees = (activite.ANNULEE_CLIENT ?? 0) + (activite.ANNULEE_SALON ?? 0)

  const chiffres = [
    { cle: "actifs", valeur: reseau.ACTIF ?? 0, libelle: "salons en ligne" },
    { cle: "honorees", valeur: honorees, libelle: "rendez-vous honorés" },
    { cle: "annulees", valeur: annulees, libelle: "annulations" },
    {
      cle: "volume",
      valeur: prix(volumeMad),
      libelle: "volume passé par la plateforme",
    },
  ]

  return (
    <section>
      <Titre complement="sur trente jours" lien="/admin" libelleLien="Tout le détail">
        La plateforme
      </Titre>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chiffres.map((c) => (
          <div key={c.cle} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <dd className="text-2xl font-bold tabular-nums text-stone-900">{c.valeur}</dd>
            <dt className="mt-0.5 text-xs text-stone-500">{c.libelle}</dt>
          </div>
        ))}
      </dl>
      {dormants.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-stone-700">
            Installés, jamais partis
          </p>
          <ul className="mt-2 divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {dormants.slice(0, 5).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{s.nom}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{s.ville}</p>
                </div>
                {/* Un catalogue vide n'est pas un salon qui ne marche pas :
                    c'est un salon qui ne peut pas marcher. Les deux se
                    rattrapent différemment, le tableau les distingue donc. */}
                <span className="text-xs text-stone-500">
                  {s.catalogueVide ? "aucune prestation au catalogue" : "aucune réservation"}
                </span>
              </li>
            ))}
          </ul>
          {dormants.length > 5 && (
            <p className="mt-2 text-sm text-stone-400">
              et {dormants.length - 5} autre{dormants.length - 5 > 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {(fileCommerciale.CONVERTIE ?? 0) > 0 && (
        <p className="mt-3 text-sm text-stone-500">
          {fileCommerciale.CONVERTIE} demande{fileCommerciale.CONVERTIE > 1 ? "s" : ""} converti
          {fileCommerciale.CONVERTIE > 1 ? "es" : "e"} en salon
          {typeof tauxConversionPourcent === "number" && ` · ${tauxConversionPourcent} % de conversion`}
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

function Titre({ children, complement, lien, libelleLien }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-stone-900">
        <MarqueFleur className="h-3 w-3 shrink-0 text-brand-400" />
        {children}
        {complement && <span className="text-sm font-normal text-stone-400">{complement}</span>}
      </h2>
      {lien && <Link to={lien} className="text-sm text-brand-700 underline hover:text-brand-800">{libelleLien}</Link>}
    </div>
  )
}
