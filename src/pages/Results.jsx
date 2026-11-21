import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { publicApi } from "../api/bookingApi"
import SearchBar from "../components/SearchBar"
import SalonCard from "../components/SalonCard"
import { ErrorState } from "../components/Loader"
import {
  Coiffure, Barbier, Onglerie, Esthetique, Hammam, Boussole,
} from "../components/Glyphes"
import { ORDRE_METIERS, libelleMetier } from "../lib/metiers"

/** Rayon de départ, et maximum accepté par le serveur. */
const RAYON_DEFAUT = 25
const RAYON_MAX = 100

const GLYPHES = {
  COIFFURE: Coiffure, BARBIER: Barbier, ONGLERIE: Onglerie,
  ESTHETIQUE: Esthetique, SPA: Hammam,
}

/**
 * Squelettes de chargement, à la place d'un rouet.
 *
 * Un rouet centré sur une page vide ne dit rien de ce qui arrive. Des cadres
 * à la forme des cartes annoncent la mise en page, et l'attente paraît plus
 * courte parce qu'on sait déjà où regarder.
 */
function Squelettes() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
          <div className="h-28 animate-pulse bg-stone-200/70" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
            <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Résultats de recherche.
 *
 * Le filtre par métier est appliqué par le serveur, sur l'ensemble des métiers
 * exercés — un institut déclaré en coiffure qui fait aussi les ongles remonte
 * sous « Onglerie ». Il l'était côté client sur la page reçue, ce qui ne
 * filtrait que les vingt premiers résultats : « Onglerie » pouvait ne rien
 * rendre alors que la ville comptait plusieurs ongleries.
 *
 * Conséquence : les pastilles de métier ne peuvent plus se déduire des
 * résultats affichés, puisque filtrer par un métier fait disparaître les
 * autres. Elles viennent donc de la liste fixe des cinq familles.
 */
export default function Results() {
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const ville = params.get("ville") ?? ""
  const metier = params.get("metier") ?? ""
  // Une coordonnée seule ne situe rien, et le serveur la refuse : les deux
  // doivent être là pour que la recherche soit dite « située ».
  const lat = params.get("lat")
  const lng = params.get("lng")
  const situee = Boolean(lat && lng)
  const rayon = Number(params.get("rayon")) || RAYON_DEFAUT

  const [etat, setEtat] = useState({ statut: "chargement", data: null, erreur: null })
  /*
   * Les pages suivantes s'ajoutent à la première.
   *
   * La recherche n'avait aucune pagination : vingt résultats, et le
   * vingt-et-unième salon référencé à Casablanca devenait invisible pour tout
   * le monde, sans message. « Afficher plus » cumule les pages, et le total
   * dit combien il en reste.
   */
  const [suite, setSuite] = useState({ salons: [], page: 0, enCours: false })

  /* Filtres et tri, côté navigateur : ils portent sur ce que la page sait
     déjà — note, prix d'entrée, « ouvert là », premier créneau — sans
     nouvel aller-retour. Dans l'URL, pour qu'un lien les garde. */
  const filtres = (params.get("f") ?? "").split(",").filter(Boolean)
  const tri = params.get("tri") ?? ""
  /**
   * Premier créneau libre de chaque salon de la page.
   *
   * Chargé après la liste, et non avec elle : la disponibilité enrichit des
   * cartes déjà visibles, elle ne doit pas retarder leur affichage. Un échec
   * ne se voit donc pas — les cartes restent, simplement sans cette ligne.
   */
  const [dispos, setDispos] = useState({})

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: null, erreur: null })
    publicApi
      .rechercherSalons({
        q, ville, metier,
        ...(situee ? { lat, lng, rayon } : {}),
      })
      .then((data) => {
        setEtat({ statut: "ok", data, erreur: null })
        setSuite({ salons: [], page: 0, enCours: false })
        const ids = (data.content ?? []).map((s) => s.id)
        setDispos({})
        publicApi.premiersCreneaux(ids).then(setDispos).catch(() => setDispos({}))
      })
      .catch((erreur) => setEtat({ statut: "erreur", data: null, erreur }))
  }, [q, ville, metier, situee, lat, lng, rayon])

  useEffect(charger, [charger])

  const chargerSuite = () => {
    const page = suite.page + 1
    setSuite((x) => ({ ...x, enCours: true }))
    publicApi
      .rechercherSalons({ q, ville, metier, page, ...(situee ? { lat, lng, rayon } : {}) })
      .then((data) => {
        const nouveaux = data.content ?? []
        setSuite((x) => ({ salons: [...x.salons, ...nouveaux], page, enCours: false }))
        publicApi.premiersCreneaux(nouveaux.map((s) => s.id))
          .then((d) => setDispos((x) => ({ ...x, ...d }))).catch(() => {})
      })
      .catch(() => setSuite((x) => ({ ...x, enCours: false })))
  }

  const tous = [...(etat.data?.content ?? []), ...suite.salons]
  const total = etat.data?.totalElements ?? tous.length
  const resteAVoir = Math.max(0, total - tous.length)

  const basculerFiltre = (cle) => {
    const suivant = new URLSearchParams(params)
    const actifs = filtres.includes(cle) ? filtres.filter((f) => f !== cle) : [...filtres, cle]
    if (actifs.length) suivant.set("f", actifs.join(",")); else suivant.delete("f")
    setParams(suivant, { replace: true })
  }
  const changerTri = (valeur) => {
    const suivant = new URLSearchParams(params)
    if (valeur) suivant.set("tri", valeur); else suivant.delete("tri")
    setParams(suivant, { replace: true })
  }

  const aujourdhuiIso = new Date().toISOString().slice(0, 10)
  const salons = tous
    .filter((s) => !filtres.includes("ouvert") || s.ouvertMaintenant === true)
    .filter((s) => !filtres.includes("aujourdhui") || dispos[s.id]?.date === aujourdhuiIso)
    .filter((s) => !filtres.includes("note") || (s.noteMoyenne != null && Number(s.noteMoyenne) >= 4.5))
    .filter((s) => !filtres.includes("prix") || (s.prixMin != null && Number(s.prixMin) <= 150))
    .sort((a, b) => {
      if (tri === "note") return (Number(b.noteMoyenne) || 0) - (Number(a.noteMoyenne) || 0)
      if (tri === "prix") return (Number(a.prixMin) || 1e9) - (Number(b.prixMin) || 1e9)
      if (tri === "distance") return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)
      return 0
    })

  const elargir = () => {
    const suivant = new URLSearchParams(params)
    suivant.set("rayon", RAYON_MAX)
    setParams(suivant, { replace: true })
  }

  /** Retour à une recherche ordinaire : la position quitte l'URL. */
  const oublierPosition = () => {
    const suivant = new URLSearchParams(params)
    suivant.delete("lat")
    suivant.delete("lng")
    suivant.delete("rayon")
    setParams(suivant, { replace: true })
  }

  const basculerMetier = (cle) => {
    const suivant = new URLSearchParams(params)
    if (cle === metier) suivant.delete("metier")
    else suivant.set("metier", cle)
    setParams(suivant, { replace: true })
  }

  return (
    <div>
      {/* La barre de recherche sur un fond teinté : elle se détache de la
          liste au lieu de flotter dans le même blanc que les cartes. */}
      <div className="relative overflow-hidden border-b border-stone-200/70 bg-gradient-to-b from-brand-50/70 to-ivoire">
        <div className="relative mx-auto max-w-6xl px-4 py-7">
          <SearchBar valeursInitiales={{ q, ville }} variante="hero" situee={situee} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {etat.statut === "chargement" && <Squelettes />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}

        {etat.statut === "ok" && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
              {/* Le compte n'apparaît qu'à partir de dix : « 4 salons » en
                  titre dit à un gérant qu'il serait le cinquième. */}
              <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight text-stone-900">
                {total === 0
                  ? "Aucun salon"
                  : total >= 10 ? `${total} salons` : "Salons"}
                {situee && <span className="font-normal text-stone-500">autour de vous</span>}
                {ville && !situee && <span className="font-normal text-stone-500">à {ville}</span>}
              </h1>

              <div className="flex flex-wrap gap-2">
                  {ORDRE_METIERS.map((cle) => {
                    const Glyphe = GLYPHES[cle]
                    const actif = metier === cle
                    return (
                      <button
                        key={cle}
                        onClick={() => basculerMetier(cle)}
                        aria-pressed={actif}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${
                          actif
                            ? "border-brand-600 bg-brand-600 font-medium text-white"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        <Glyphe className="h-4 w-4" />
                        {libelleMetier(cle)}
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* Filtres utiles et tri. Une liste sans « ouvert maintenant »,
                sans « disponible aujourd'hui », sans note ni prix n'est pas
                une recherche : c'est un annuaire. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                ["ouvert", "Ouvert maintenant"],
                ["aujourdhui", "Libre aujourd'hui"],
                ["note", "Note ≥ 4,5"],
                ["prix", "Dès 150 MAD ou moins"],
              ].map(([cle, libelle]) => {
                const actif = filtres.includes(cle)
                return (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => basculerFiltre(cle)}
                    aria-pressed={actif}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      actif
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    {libelle}
                  </button>
                )
              })}
              <label className="ml-auto flex items-center gap-2 text-xs text-stone-500">
                Trier
                <select
                  value={tri}
                  onChange={(e) => changerTri(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700"
                >
                  <option value="">Pertinence</option>
                  <option value="note">Mieux notés</option>
                  <option value="prix">Prix d'entrée</option>
                  {situee && <option value="distance">Les plus proches</option>}
                </select>
              </label>
            </div>

            {situee && (
              /* Ce que le classement vaut, et comment en sortir.
                 Une liste triée par distance sans dire depuis quel point ni
                 avec quelle précision invite à lire « à 3 km » comme un
                 relevé : c'est une distance à vol d'oiseau, depuis le centre
                 du quartier du salon tant que ses coordonnées n'ont pas été
                 relevées. Mieux vaut l'écrire une fois en haut que laisser
                 chaque carte le laisser croire. */
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200/70">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-stone-800">
                  <Boussole className="h-4 w-4 text-brand-600" />
                  Du plus proche au plus lointain
                </span>
                <span className="text-sm text-stone-500">
                  à moins de {rayon} km · distances à vol d’oiseau, au quartier près
                </span>
                {etat.data?.nonSitues > 0 && (
                  <span className="text-sm text-stone-500">
                    · {etat.data.nonSitues} salon{etat.data.nonSitues > 1 ? "s" : ""} non
                    situé{etat.data.nonSitues > 1 ? "s" : ""}, absent
                    {etat.data.nonSitues > 1 ? "s" : ""} de ce classement
                  </span>
                )}
                <button
                  type="button"
                  onClick={oublierPosition}
                  className="ml-auto text-sm font-medium text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
                >
                  Voir tous les salons
                </button>
              </div>
            )}

            {salons.length === 0 ? (
              <div className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200/70">
                <div className="p-10 text-center">
                  <h2 className="mt-4 text-xl font-semibold text-stone-900">
                    {situee
                      ? `Aucun salon à moins de ${rayon} km`
                      : `Rien ne correspond${metier ? " à ce métier" : ""}`}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">
                    {situee
                      ? "Le réseau s’étend ville par ville. Élargissez la recherche, ou choisissez une ville dans la liste."
                      : metier
                        ? "Retirez le filtre de métier, ou essayez une autre ville."
                        : "Essayez une autre ville, ou des mots-clés plus larges. Le réseau s’étend salon par salon."}
                  </p>
                  {/* Élargir plutôt que rendre la main : à 25 km de chez soi il
                      n'y a peut-être aucun salon, à 100 il y a la ville
                      voisine. Le bouton disparaît au maximum accepté par le
                      serveur, pour ne pas promettre un élargissement qui
                      rendrait la même page. */}
                  {situee && rayon < RAYON_MAX && (
                    <button
                      onClick={elargir}
                      className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Chercher jusqu’à {RAYON_MAX} km
                    </button>
                  )}
                  {!situee && metier && (
                    <button
                      onClick={() => basculerMetier(metier)}
                      className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Retirer le filtre de métier
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {salons.map((s) => (
                    <SalonCard
                      key={s.id}
                      salon={s}
                      villeFiltree={Boolean(ville)}
                      metierFiltre={metier || null}
                      dispo={dispos[s.id] ?? null}
                    />
                  ))}
                </div>
                {salons.length === 0 && tous.length > 0 && (
                  <p className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-stone-200/70">
                    Aucun salon ne correspond à ces filtres.{" "}
                    <button type="button" onClick={() => { const n = new URLSearchParams(params); n.delete("f"); setParams(n, { replace: true }) }} className="font-medium text-brand-700 underline underline-offset-4">
                      Les retirer
                    </button>
                  </p>
                )}
                {resteAVoir > 0 && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={chargerSuite}
                      disabled={suite.enCours}
                      className="rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-60"
                    >
                      {suite.enCours ? "Chargement…" : `Afficher plus de salons`}
                    </button>
                    <span className="text-xs text-stone-400">
                      {tous.length} sur {total}
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
