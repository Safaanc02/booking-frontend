import { useCallback, useEffect, useState } from "react"
import { proApi } from "../../api/bookingApi"
import Loader, { ErrorState } from "../../components/Loader"

const JOURS = [
  [1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"],
  [5, "Vendredi"], [6, "Samedi"], [7, "Dimanche"],
]

const VIDE = { ouvert: false, matinDebut: "09:00", matinFin: "12:00", apremDebut: "14:00", apremFin: "19:00", coupure: true }

/**
 * Horaires hebdomadaires du salon.
 *
 * Le modèle sous-jacent est une liste de plages ; l'écran présente une journée
 * avec une coupure optionnelle, parce que c'est ainsi qu'un salon raisonne.
 * Deux plages en base pour une journée coupée, une seule en journée continue.
 */
export default function OngletHoraires({ salon }) {
  const [semaine, setSemaine] = useState(() => JOURS.map(() => ({ ...VIDE })))
  const [etat, setEtat] = useState({ statut: "chargement", erreur: null })
  const [envoi, setEnvoi] = useState({ enCours: false, ok: false, erreur: null })

  const charger = useCallback(() => {
    setEtat({ statut: "chargement", erreur: null })
    proApi
      .horaires(salon.id)
      .then((liste) => {
        const parJour = JOURS.map(([n]) => {
          const plages = liste.filter((h) => h.jourSemaine === n)
                              .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
          if (plages.length === 0) return { ...VIDE }
          const hhmm = (t) => String(t).slice(0, 5)
          if (plages.length === 1) {
            return { ouvert: true, coupure: false,
                     matinDebut: hhmm(plages[0].heureDebut), matinFin: hhmm(plages[0].heureFin),
                     apremDebut: VIDE.apremDebut, apremFin: VIDE.apremFin }
          }
          return { ouvert: true, coupure: true,
                   matinDebut: hhmm(plages[0].heureDebut), matinFin: hhmm(plages[0].heureFin),
                   apremDebut: hhmm(plages[1].heureDebut), apremFin: hhmm(plages[1].heureFin) }
        })
        setSemaine(parJour)
        setEtat({ statut: "ok", erreur: null })
      })
      .catch((erreur) => setEtat({ statut: "erreur", erreur }))
  }, [salon.id])

  useEffect(charger, [charger])

  const maj = (i, champ, valeur) =>
    setSemaine((s) => s.map((j, k) => (k === i ? { ...j, [champ]: valeur } : j)))

  const copierPartout = (i) =>
    setSemaine((s) => s.map((j, k) => (k === 6 ? j : { ...s[i] })))

  const enregistrer = () => {
    const plages = []
    semaine.forEach((j, i) => {
      if (!j.ouvert) return
      const jour = JOURS[i][0]
      plages.push({ jourSemaine: jour, heureDebut: `${j.matinDebut}:00`, heureFin: `${j.matinFin}:00` })
      if (j.coupure) {
        plages.push({ jourSemaine: jour, heureDebut: `${j.apremDebut}:00`, heureFin: `${j.apremFin}:00` })
      }
    })
    setEnvoi({ enCours: true, ok: false, erreur: null })
    proApi
      .definirHoraires(salon.id, plages)
      .then(() => { setEnvoi({ enCours: false, ok: true, erreur: null }); charger() })
      .catch((erreur) => setEnvoi({ enCours: false, ok: false, erreur }))
  }

  if (etat.statut === "chargement") return <Loader />
  if (etat.statut === "erreur") return <ErrorState erreur={etat.erreur} onRetry={charger} />

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-900">Horaires d'ouverture</h2>
          <p className="text-sm text-stone-500">
            Ce sont eux qui déterminent les créneaux proposés en ligne.
          </p>
        </div>
        <button
          onClick={enregistrer}
          disabled={envoi.enCours}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-stone-300"
        >
          {envoi.enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {envoi.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Horaires enregistrés.
        </p>
      )}
      {envoi.erreur && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {envoi.erreur.message}
        </p>
      )}

      <ul className="mt-5 divide-y divide-stone-200 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        {JOURS.map(([n, libelle], i) => {
          const j = semaine[i]
          return (
            <li key={n} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={j.ouvert}
                  onChange={(e) => maj(i, "ouvert", e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className={j.ouvert ? "font-medium text-stone-900" : "text-stone-400"}>{libelle}</span>
              </label>

              {j.ouvert ? (
                <>
                  <Plage debut={j.matinDebut} fin={j.matinFin}
                         onDebut={(v) => maj(i, "matinDebut", v)} onFin={(v) => maj(i, "matinFin", v)} />
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-500">
                    <input type="checkbox" checked={j.coupure}
                           onChange={(e) => maj(i, "coupure", e.target.checked)}
                           className="h-3.5 w-3.5 accent-brand-600" />
                    coupure
                  </label>
                  {j.coupure && (
                    <Plage debut={j.apremDebut} fin={j.apremFin}
                           onDebut={(v) => maj(i, "apremDebut", v)} onFin={(v) => maj(i, "apremFin", v)} />
                  )}
                  <button onClick={() => copierPartout(i)}
                          className="ml-auto text-xs text-stone-400 underline hover:text-stone-700">
                    appliquer du lundi au samedi
                  </button>
                </>
              ) : (
                <span className="text-sm text-stone-400">Fermé</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Plage({ debut, fin, onDebut, onFin }) {
  const style = "rounded-lg border border-stone-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
  return (
    <div className="flex items-center gap-1.5">
      <input type="time" value={debut} onChange={(e) => onDebut(e.target.value)} className={style} />
      <span className="text-stone-400">→</span>
      <input type="time" value={fin} onChange={(e) => onFin(e.target.value)} className={style} />
    </div>
  )
}
