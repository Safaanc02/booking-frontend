import { useCallback, useEffect, useState } from "react"
import { proApi, publicApi } from "../../api/bookingApi"
import { heureLocale, jourLong, isoDate, prix, telephone, heureCourte } from "../../lib/format"
import Loader, { EmptyState, ErrorState } from "../../components/Loader"
import { Champ } from "./ProDashboard"

const BADGES = {
  EN_ATTENTE:     ["En attente", "bg-amber-50 text-amber-700 ring-amber-200"],
  CONFIRMEE:      ["Confirmée", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  HONOREE:        ["Honorée", "bg-sky-50 text-sky-700 ring-sky-200"],
  ABSENT:         ["Absent", "bg-red-50 text-red-700 ring-red-200"],
  ANNULEE_CLIENT: ["Annulée (client)", "bg-stone-100 text-stone-500 ring-stone-200"],
  ANNULEE_SALON:  ["Annulée (salon)", "bg-stone-100 text-stone-500 ring-stone-200"],
}

const ORIGINES = { TELEPHONE: "☎ téléphone", COMPTOIR: "🏠 comptoir" }

export default function OngletAgenda({ salon }) {
  const [jour, setJour] = useState(isoDate(new Date()))
  const [etat, setEtat] = useState({ statut: "chargement", data: [], erreur: null })
  const [saisie, setSaisie] = useState(false)
  /*
   * Colonnes ou liste.
   *
   * Un gérant pense sa journée en colonnes horaires — une par praticien, les
   * rendez-vous posés à leur heure, les trous visibles. C'est ce qu'il a sur
   * le mur du salon, et c'est ce qu'on lui montre en démonstration. La liste
   * reste pour le téléphone, où quatre colonnes ne tiendraient pas, et pour
   * qui la préfère : le choix est gardé dans le navigateur.
   */
  const [vue, setVue] = useState(() => {
    try { return localStorage.getItem("darzin.agenda.vue") || (window.innerWidth >= 768 ? "colonnes" : "liste") }
    catch { return "liste" }
  })
  const choisirVue = (v) => { setVue(v); try { localStorage.setItem("darzin.agenda.vue", v) } catch { /* privé */ } }
  const [equipe, setEquipe] = useState([])
  const [plages, setPlages] = useState([])
  const [ouvert, setOuvert] = useState(null) // le rendez-vous dont les actions sont dépliées

  /* Les colonnes ont besoin de l'équipe et des horaires du salon : chargés
     une fois, ils ne changent pas d'un jour à l'autre. */
  useEffect(() => {
    proApi.employes(salon.id).then((l) => setEquipe(l.filter((e) => e.actif !== false))).catch(() => setEquipe([]))
    proApi.horaires(salon.id).then(setPlages).catch(() => setPlages([]))
  }, [salon.id])

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", data: [], erreur: null })
    proApi
      .agenda(salon.id, { date: jour, jours: 1 })
      .then((data) => setEtat({ statut: "ok", data, erreur: null }))
      .catch((erreur) => setEtat({ statut: "erreur", data: [], erreur }))
  }, [salon.id, jour])

  useEffect(charger, [charger])

  const decaler = (n) => {
    const d = new Date(`${jour}T12:00:00`)
    d.setDate(d.getDate() + n)
    setJour(isoDate(d))
  }

  const marquer = (id, statut) => {
    proApi.changerStatut(id, statut).then(charger).catch(() => charger())
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => decaler(-1)} aria-label="Jour précédent"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">←</button>
          <button onClick={() => setJour(isoDate(new Date()))}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Aujourd'hui</button>
          <button onClick={() => decaler(1)} aria-label="Jour suivant"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">→</button>
          <span className="ml-2 font-medium text-stone-800">{jourLong(jour)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Affichage" className="hidden overflow-hidden rounded-lg border border-stone-300 text-sm md:flex">
            {[["colonnes", "Colonnes"], ["liste", "Liste"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => choisirVue(v)} aria-pressed={vue === v}
                className={`px-3 py-1.5 transition ${vue === v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"}`}>
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSaisie(!saisie)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {saisie ? "Fermer" : "Rendez-vous par téléphone"}
          </button>
        </div>
      </div>

      {saisie && (
        <SaisieTelephone
          salon={salon}
          jour={jour}
          onEnregistre={() => { setSaisie(false); charger() }}
        />
      )}

      <div className="mt-5">
        {etat.statut === "chargement" && <Loader />}
        {etat.statut === "erreur" && <ErrorState erreur={etat.erreur} onRetry={charger} />}
        {etat.statut === "ok" && vue === "colonnes" && equipe.length > 0 && (
          <Colonnes
            jour={jour}
            rendezVous={etat.data}
            equipe={equipe}
            plages={plages}
            ouvert={ouvert}
            onOuvrir={setOuvert}
            onMarquer={(id, statut) => { setOuvert(null); marquer(id, statut) }}
          />
        )}
        {etat.statut === "ok" && (vue === "liste" || equipe.length === 0) && (
          etat.data.length === 0 ? (
            <EmptyState titre="Aucun rendez-vous ce jour-là">
              Les réservations en ligne apparaîtront ici automatiquement.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              {etat.data.map((r) => {
                const [libelle, classes] = BADGES[r.statut] ?? [r.statut, "bg-stone-100 text-stone-600 ring-stone-200"]
                const modifiable = r.statut === "CONFIRMEE" || r.statut === "EN_ATTENTE"
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-4 p-4">
                    <div className="w-16 shrink-0">
                      <p className="font-semibold text-stone-900">{heureLocale(r.debut)}</p>
                      <p className="text-xs text-stone-400">{heureLocale(r.fin)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {r.client}
                        {r.origine !== "EN_LIGNE" && (
                          <span className="ml-2 text-xs font-normal text-stone-400">{ORIGINES[r.origine]}</span>
                        )}
                        {/* « Les clientes ne viennent pas » est la première
                            plainte de tous les salons, et le statut « Absent »
                            ne déclenchait rien. Le compteur ne punit personne :
                            il met l'information sous les yeux du gérant au
                            moment où elle sert, quand il regarde sa journée et
                            décide s'il rappelle pour confirmer.
                            Dans ce salon seulement — une absence chez le voisin
                            ne le regarde pas. */}
                        {r.absencesClient > 0 && (
                          <span
                            title={`${r.absencesClient} absence${r.absencesClient > 1 ? "s" : ""} dans votre salon`}
                            className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200"
                          >
                            {r.absencesClient} absence{r.absencesClient > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-stone-600">{r.prestation} · {r.employe}</p>
                      {r.clientTelephone && (
                        <p className="text-sm text-stone-400">{telephone(r.clientTelephone)}</p>
                      )}
                      {r.noteClient && <p className="mt-1 text-xs italic text-stone-400">« {r.noteClient} »</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${classes}`}>{libelle}</span>
                      <span className="text-sm font-semibold text-stone-900">{prix(r.prix)}</span>
                      {modifiable && (
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => marquer(r.id, "HONOREE")} className="text-emerald-700 underline">Honorée</button>
                          <button onClick={() => marquer(r.id, "ABSENT")} className="text-red-700 underline">Absent</button>
                          <button onClick={() => marquer(r.id, "ANNULEE_SALON")} className="text-stone-500 underline">Annuler</button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
  )
}

/**
 * Saisie d'un rendez-vous pris au téléphone.
 *
 * Indispensable : sans elle le salon tient deux agendas — le nôtre et son
 * carnet — et les créneaux pris par téléphone restent proposés en ligne.
 */
/*
 * La journée en colonnes.
 *
 * Une colonne par praticien, une ligne par demi-heure entre la première
 * ouverture et la dernière fermeture du jour (9 h – 19 h à défaut
 * d'horaires saisis). Chaque rendez-vous est un bloc posé à son heure, haut
 * comme sa durée ; les plages hors ouverture sont hachurées ; un trait rouge
 * marque l'heure qu'il est, quand c'est aujourd'hui.
 *
 * Les actions — honorée, absente, annuler — se déplient au clic sur le bloc,
 * et non en permanence : quarante rendez-vous avec trois boutons chacun,
 * c'est cent vingt boutons sur un écran.
 */
const PAS_MIN = 30
const HAUTEUR_PAS = 44 // px par demi-heure

function Colonnes({ jour, rendezVous, equipe, plages, ouvert, onOuvrir, onMarquer }) {
  const jourIso = ((new Date(`${jour}T12:00:00`).getDay() + 6) % 7) + 1
  const dujour = plages.filter((p) => p.jourSemaine === jourIso)
  const minutes = (h) => { const [hh, mm] = String(h).split(":").map(Number); return hh * 60 + mm }
  const debutJour = dujour.length ? Math.min(...dujour.map((p) => minutes(p.heureDebut))) : 9 * 60
  const finJour = dujour.length ? Math.max(...dujour.map((p) => minutes(p.heureFin))) : 19 * 60
  const lignes = []
  for (let m = debutJour; m < finJour; m += PAS_MIN) lignes.push(m)
  const hauteur = lignes.length * HAUTEUR_PAS

  const local = (iso) => { const d = new Date(iso); return Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(d).replace(/\D/g, "")) * 60 + d.getMinutes() }
  const y = (iso) => ((local(iso) - debutJour) / PAS_MIN) * HAUTEUR_PAS

  const aujourdhui = isoDate(new Date()) === jour
  const maintenant = new Date()
  const yMaintenant = aujourdhui ? ((Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(maintenant).replace(/\D/g, "")) * 60 + maintenant.getMinutes() - debutJour) / PAS_MIN) * HAUTEUR_PAS : null

  const TEINTES = {
    CONFIRMEE: "bg-emerald-50 ring-emerald-300 text-emerald-900",
    EN_ATTENTE: "bg-amber-50 ring-amber-300 text-amber-900",
    HONOREE: "bg-sky-50 ring-sky-300 text-sky-900",
    ABSENT: "bg-red-50 ring-red-300 text-red-900",
    ANNULEE_CLIENT: "bg-stone-100 ring-stone-200 text-stone-400 line-through",
    ANNULEE_SALON: "bg-stone-100 ring-stone-200 text-stone-400 line-through",
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${equipe.length}, minmax(150px, 1fr))` }}>
        {/* en-têtes */}
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white" />
        {equipe.map((e) => (
          <div key={e.id} className="sticky top-0 z-10 border-b border-l border-stone-200 bg-white px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-stone-900">{e.prenom} {e.nom}</p>
            <p className="truncate text-xs text-stone-500">{e.titre || ""}</p>
          </div>
        ))}

        {/* heures — la première étiquette ne remonte pas : centrée sur sa
            ligne, elle passait à moitié sous l'en-tête des colonnes. */}
        <div className="relative" style={{ height: hauteur }}>
          {lignes.map((m) => (
            <div key={m} className={`absolute right-2 text-[11px] tabular-nums text-stone-400 ${m === debutJour ? "translate-y-0.5" : "-translate-y-1/2"}`} style={{ top: ((m - debutJour) / PAS_MIN) * HAUTEUR_PAS }}>
              {m % 60 === 0 ? `${String(m / 60).padStart(2, "0")}:00` : ""}
            </div>
          ))}
        </div>

        {/* colonnes */}
        {equipe.map((e) => {
          const siens = rendezVous.filter((r) => r.employeId === e.id)
          return (
            <div key={e.id} className="relative border-l border-stone-200" style={{ height: hauteur }}>
              {lignes.map((m) => (
                <div key={m} className={`absolute inset-x-0 border-t ${m % 60 === 0 ? "border-stone-200" : "border-stone-100"}`} style={{ top: ((m - debutJour) / PAS_MIN) * HAUTEUR_PAS }} />
              ))}
              {yMaintenant != null && yMaintenant >= 0 && yMaintenant <= hauteur && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-brand-500" style={{ top: yMaintenant }} />
              )}
              {siens.map((r) => {
                const top = Math.max(0, y(r.debut))
                const h = Math.max(HAUTEUR_PAS * 0.8, y(r.fin) - y(r.debut))
                const deplie = ouvert === r.id
                const modifiable = r.statut === "CONFIRMEE" || r.statut === "EN_ATTENTE"
                return (
                  <div key={r.id} className={`absolute inset-x-1 ${deplie ? "z-20" : "z-0"}`} style={{ top: top + 2, minHeight: h - 4 }}>
                    <button
                      type="button"
                      onClick={() => onOuvrir(deplie ? null : r.id)}
                      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition hover:shadow-carte ${TEINTES[r.statut] ?? "bg-stone-50 ring-stone-200"}`}
                      style={{ minHeight: h - 4 }}
                    >
                      <span className="block truncate font-semibold">{r.client}</span>
                      <span className="block truncate">{r.prestation}</span>
                      <span className="block tabular-nums opacity-70">{heureLocale(r.debut)}–{heureLocale(r.fin)}</span>
                      {r.absencesClient > 0 && <span className="mt-0.5 inline-block rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{r.absencesClient} abs.</span>}
                    </button>
                    {deplie && (
                      <div className="mt-1 rounded-lg bg-white p-2.5 text-xs shadow-carte-levee ring-1 ring-stone-200">
                        {r.clientTelephone && <p className="text-stone-600">{telephone(r.clientTelephone)}</p>}
                        {r.noteClient && <p className="mt-1 italic text-stone-500">« {r.noteClient} »</p>}
                        <p className="mt-1 font-semibold text-stone-900">{prix(r.prix)}</p>
                        {modifiable && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button onClick={() => onMarquer(r.id, "HONOREE")} className="rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white">Honorée</button>
                            <button onClick={() => onMarquer(r.id, "ABSENT")} className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white">Absente</button>
                            <button onClick={() => onMarquer(r.id, "ANNULEE_SALON")} className="rounded-md border border-stone-300 px-2 py-1 text-stone-700">Annuler</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SaisieTelephone({ salon, jour, onEnregistre }) {
  const prestations = salon.prestations ?? []
  const [form, setForm] = useState({
    prestationId: prestations[0]?.id ?? "",
    employeId: "",
    heure: "",
    clientNom: "",
    clientTelephone: "",
    note: "",
  })
  const [employes, setEmployes] = useState([])
  const [creneaux, setCreneaux] = useState([])
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const maj = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (!form.prestationId) return
    publicApi.employesPour(salon.id, form.prestationId).then(setEmployes).catch(() => setEmployes([]))
  }, [salon.id, form.prestationId])

  useEffect(() => {
    if (!form.prestationId || !form.employeId) { setCreneaux([]); return }
    publicApi
      // frais : ce formulaire appartient au gérant, qui vient peut-être de
      // déclarer une fermeture ou de changer ses horaires. Lui montrer la
      // réponse d'il y a une minute lui ferait croire que sa saisie n'a rien
      // fait.
      .disponibilites(salon.id, {
        prestationId: form.prestationId, date: jour, employeId: form.employeId, frais: true,
      })
      .then((d) => setCreneaux(d.creneaux ?? []))
      .catch(() => setCreneaux([]))
  }, [salon.id, form.prestationId, form.employeId, jour])

  const soumettre = (e) => {
    e.preventDefault()
    setEnvoi({ enCours: true, erreur: null })
    proApi
      .creerReservation(salon.id, {
        prestationId: Number(form.prestationId),
        employeId: Number(form.employeId),
        debut: form.heure,
        clientNom: form.clientNom,
        clientTelephone: form.clientTelephone || null,
        note: form.note || null,
        origine: "TELEPHONE",
      })
      .then(onEnregistre)
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const champs = envoi.erreur?.details ?? {}

  return (
    <form onSubmit={soumettre} className="mt-4 rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
      <p className="text-sm font-medium text-stone-800">Rendez-vous du {jourLong(jour)}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-stone-600">Prestation</span>
          <select value={form.prestationId} onChange={maj("prestationId")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            {prestations.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-stone-600">Praticien</span>
          <select value={form.employeId} onChange={maj("employeId")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            <option value="">Choisir…</option>
            {employes.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm text-stone-600">
            Créneau {creneaux.length === 0 && form.employeId && "— aucun disponible ce jour-là"}
          </span>
          <select value={form.heure} onChange={maj("heure")}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm">
            <option value="">Choisir…</option>
            {creneaux.map((c) => (
              <option key={c.debut} value={c.debut}>{heureLocale(c.debut)}</option>
            ))}
          </select>
        </label>

        <Champ label="Nom du client" value={form.clientNom} onChange={maj("clientNom")}
               erreur={champs.clientNom} required />
        <Champ label="Téléphone" value={form.clientTelephone} onChange={maj("clientTelephone")}
               erreur={champs.clientTelephone} placeholder="0612345678" />
        <Champ label="Note" value={form.note} onChange={maj("note")} className="sm:col-span-2" />
      </div>

      {envoi.erreur && !envoi.erreur.details && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {envoi.erreur.message}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi.enCours || !form.heure || !form.employeId}
        className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
      >
        {envoi.enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  )
}
