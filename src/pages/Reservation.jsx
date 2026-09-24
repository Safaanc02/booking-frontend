import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { publicApi, reservationsApi } from "../api/bookingApi"
import { useAuth } from "../auth/useAuth"
import Stepper from "../components/Stepper"
import CalendarSlots from "../components/CalendarSlots"
import Loader, { EmptyState, ErrorState } from "../components/Loader"
import { prix, duree, instantLong } from "../lib/format"

const ETAPES = ["Prestation", "Praticien", "Créneau", "Confirmation"]

/**
 * Sauvegarde du choix en cours avant la redirection vers Keycloak.
 *
 * La connexion quitte l'application : au retour, React est remonté à zéro et
 * tout le tunnel serait perdu. Faire refaire quatre écrans à quelqu'un qui
 * vient de saisir son mot de passe est le meilleur moyen de le perdre là.
 *
 * sessionStorage plutôt que localStorage : la reprise n'a de sens que dans
 * l'onglet en cours, et rien ne doit survivre à sa fermeture.
 */
const cle = (salonId) => `reservation:${salonId}`

/** Au-delà, la reprise n'a plus de sens : le créneau a probablement été pris. */
const PEREMPTION_MS = 15 * 60 * 1000

const memoriser = (salonId, choix) => {
  try {
    sessionStorage.setItem(cle(salonId), JSON.stringify({ ...choix, ts: Date.now() }))
  } catch {
    // Navigation privée ou stockage bloqué : on perd la reprise, pas la réservation.
  }
}

/**
 * Lit sans consommer.
 *
 * Une première version supprimait l'entrée à la lecture. En développement,
 * StrictMode monte le composant deux fois : le premier montage consommait la
 * reprise avant d'être jeté, et le second ne trouvait plus rien. La péremption
 * remplace la suppression immédiate.
 */
const reprendre = (salonId) => {
  try {
    const brut = sessionStorage.getItem(cle(salonId))
    if (!brut) return null
    const choix = JSON.parse(brut)
    if (!choix.ts || Date.now() - choix.ts > PEREMPTION_MS) {
      sessionStorage.removeItem(cle(salonId))
      return null
    }
    return choix
  } catch {
    return null
  }
}

const oublier = (salonId) => {
  try {
    sessionStorage.removeItem(cle(salonId))
  } catch {
    /* rien à faire */
  }
}

export default function Reservation() {
  const { id: salonId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { authenticated, ready, login } = useAuth()

  const [salon, setSalon] = useState({ statut: "chargement", data: null, erreur: null })
  const [etape, setEtape] = useState(0)
  const [prestation, setPrestation] = useState(null)
  const [employes, setEmployes] = useState([])
  const [employeId, setEmployeId] = useState(null) // null = sans préférence
  const [creneau, setCreneau] = useState(null)
  const [note, setNote] = useState("")
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })

  /* ---------- Chargement de la fiche ---------- */

  useEffect(() => {
    publicApi
      .ficheSalon(salonId)
      .then((data) => {
        setSalon({ statut: "ok", data, erreur: null })

        // Retour de Keycloak : on restaure le choix et on repose le visiteur
        // directement sur le récapitulatif.
        const repris = reprendre(salonId)
        if (repris) {
          const p = data.prestations?.find((x) => x.id === repris.prestationId)
          if (p) {
            setPrestation(p)
            setEmployeId(repris.employeId ?? null)
            setCreneau(repris.creneau)
            setNote(repris.note ?? "")
            setEtape(3)
            return
          }
        }

        // Prestation pré-sélectionnée depuis la fiche salon : on saute l'étape 1.
        const pid = Number(params.get("prestationId"))
        const trouvee = data.prestations?.find((x) => x.id === pid)
        if (trouvee) {
          setPrestation(trouvee)
          setEtape(1)
        }
      })
      .catch((erreur) => setSalon({ statut: "erreur", data: null, erreur }))
  }, [salonId, params])

  /* ---------- Praticiens capables ---------- */

  useEffect(() => {
    if (!prestation) return
    publicApi
      .employesPour(salonId, prestation.id)
      .then(setEmployes)
      .catch(() => setEmployes([]))
  }, [salonId, prestation])

  /* ---------- Navigation ---------- */

  const choisirPrestation = (p) => {
    oublier(salonId)
    setPrestation(p)
    setEmployeId(null)
    setCreneau(null)
    setEtape(1)
  }

  const choisirPraticien = (eid) => {
    oublier(salonId)
    setEmployeId(eid)
    setCreneau(null)
    setEtape(2)
  }

  const choisirCreneau = (c) => {
    setCreneau(c)
    setEtape(3)
  }

  const confirmer = useCallback(() => {
    if (!authenticated) {
      // On ne demande le compte qu'ici : c'est l'étape où l'abandon coûte le moins.
      // Le choix est mis de côté pour être retrouvé au retour de Keycloak.
      memoriser(salonId, {
        prestationId: prestation.id,
        employeId,
        creneau,
        note,
      })
      login()
      return
    }
    setEnvoi({ enCours: true, erreur: null })

    reservationsApi
      .creer({
        salonId: Number(salonId),
        prestationId: prestation.id,
        // En « sans préférence », le backend attribue le premier praticien libre.
        employeId: employeId ?? creneau?.employesDisponibles?.[0] ?? null,
        debut: creneau.debut,
        noteClient: note.trim() || null,
      })
      .then(() => {
        oublier(salonId)
        navigate("/compte?reservation=ok")
      })
      .catch((erreur) => {
        setEnvoi({ enCours: false, erreur })
        // Créneau pris entre-temps : on renvoie au choix de l'horaire.
        if (erreur.status === 409) setEtape(2)
      })
  }, [authenticated, login, salonId, prestation, employeId, creneau, note, navigate])

  /* ---------- Rendu ---------- */

  if (salon.statut === "chargement" || !ready) return <Loader />
  if (salon.statut === "erreur") {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState erreur={salon.erreur} /></div>
  }

  const s = salon.data
  const prestations = s.prestations ?? []
  const praticienChoisi = employes.find((e) => e.id === employeId)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={`/salon/${salonId}`} className="text-sm text-stone-500 hover:text-stone-800">
        ← {s.nom}
      </Link>

      <div className="mt-4 overflow-x-auto pb-1">
        <Stepper etapes={ETAPES} courante={etape} onAller={setEtape} />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">

        {/* ---- 1. Prestation ---- */}
        {etape === 0 && (
          prestations.length === 0 ? (
            <EmptyState titre="Ce salon n'a pas encore publié de prestations" />
          ) : (
            <>
              <h2 className="text-lg font-semibold text-stone-900">Quelle prestation ?</h2>
              <ul className="mt-4 divide-y divide-stone-100">
                {prestations.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => choisirPrestation(p)}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:bg-stone-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900">{p.nom}</p>
                        {p.description && <p className="text-sm text-stone-500">{p.description}</p>}
                        <p className="mt-0.5 text-sm text-stone-400">{duree(p.dureeMinutes)}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-stone-900">{prix(p.prix)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        )}

        {/* ---- 2. Praticien ---- */}
        {etape === 1 && (
          <>
            <h2 className="text-lg font-semibold text-stone-900">Avec qui ?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Choix par défaut : c'est celui que prend la majorité des clients. */}
              <button
                onClick={() => choisirPraticien(null)}
                className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4 text-left transition hover:bg-brand-100"
              >
                <p className="font-medium text-brand-800">Sans préférence</p>
                <p className="mt-0.5 text-sm text-brand-700">Le plus de créneaux disponibles</p>
              </button>

              {employes.map((e) => (
                <button
                  key={e.id}
                  onClick={() => choisirPraticien(e.id)}
                  className="rounded-xl border border-stone-200 p-4 text-left transition hover:border-brand-300 hover:bg-stone-50"
                >
                  <p className="font-medium text-stone-900">{e.prenom} {e.nom}</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {e.titre}{e.dureeMinutes ? ` · ${duree(e.dureeMinutes)}` : ""}
                  </p>
                </button>
              ))}
            </div>
            {employes.length === 0 && (
              <p className="mt-4 text-sm text-stone-500">
                Aucun praticien n'est rattaché à cette prestation pour le moment.
              </p>
            )}
          </>
        )}

        {/* ---- 3. Créneau ---- */}
        {etape === 2 && prestation && (
          <>
            <h2 className="text-lg font-semibold text-stone-900">Quand ?</h2>
            <p className="mt-1 text-sm text-stone-500">
              {prestation.nom} · {duree(prestation.dureeMinutes)}
              {praticienChoisi ? ` · avec ${praticienChoisi.prenom}` : " · sans préférence"}
            </p>
            {envoi.erreur?.status === 409 && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                {envoi.erreur.message} — choisissez un autre horaire.
              </p>
            )}
            <div className="mt-5">
              <CalendarSlots
                salonId={salonId}
                prestationId={prestation.id}
                employeId={employeId}
                onChoisir={choisirCreneau}
              />
            </div>
          </>
        )}

        {/* ---- 4. Confirmation ---- */}
        {etape === 3 && creneau && prestation && (
          <>
            <h2 className="text-lg font-semibold text-stone-900">Récapitulatif</h2>

            <dl className="mt-4 divide-y divide-stone-100 text-sm">
              {[
                ["Salon", s.nom],
                ["Prestation", prestation.nom],
                ["Praticien", praticienChoisi ? `${praticienChoisi.prenom} ${praticienChoisi.nom ?? ""}` : "Sans préférence"],
                ["Date", instantLong(creneau.debut)],
                ["Durée", duree(prestation.dureeMinutes)],
              ].map(([cle, valeur]) => (
                <div key={cle} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-stone-500">{cle}</dt>
                  <dd className="text-right font-medium text-stone-900">{valeur}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-3">
                <dt className="font-medium text-stone-900">À régler sur place</dt>
                <dd className="text-lg font-bold text-stone-900">{prix(prestation.prix)}</dd>
              </div>
            </dl>

            <label className="mt-4 block">
              <span className="text-sm text-stone-600">Un mot pour le salon (facultatif)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Première visite, cheveux longs…"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>

            {envoi.erreur && envoi.erreur.status !== 409 && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
                {envoi.erreur.message}
              </p>
            )}

            <button
              onClick={confirmer}
              disabled={envoi.enCours}
              className="mt-5 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:bg-stone-300"
            >
              {envoi.enCours
                ? "Envoi…"
                : authenticated
                  ? "Confirmer la réservation"
                  : "Se connecter et confirmer"}
            </button>

            <p className="mt-3 text-center text-xs text-stone-400">
              Annulation gratuite jusqu'à {s.delaiAnnulationHeures ?? 24} h avant le rendez-vous.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
