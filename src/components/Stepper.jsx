/**
 * Fil d'Ariane du tunnel de réservation.
 *
 * Une étape déjà franchie reste cliquable : revenir en arrière pour changer de
 * praticien ne doit pas obliger à tout recommencer.
 */
export default function Stepper({ etapes, courante, onAller }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Étapes de la réservation">
      {etapes.map((libelle, i) => {
        const franchie = i < courante
        const active = i === courante
        return (
          <li key={libelle} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!franchie}
              onClick={() => franchie && onAller(i)}
              aria-current={active ? "step" : undefined}
              className={[
                "flex items-center gap-2 rounded-full px-3 py-1.5 transition",
                active ? "bg-brand-600 font-semibold text-white" : "",
                franchie ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "",
                !active && !franchie ? "text-stone-400" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                  active ? "bg-white/25 text-white" : "",
                  franchie ? "bg-brand-600 text-white" : "",
                  !active && !franchie ? "bg-stone-200 text-stone-500" : "",
                ].join(" ")}
              >
                {franchie ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{libelle}</span>
            </button>
            {i < etapes.length - 1 && <span aria-hidden className="text-stone-300">›</span>}
          </li>
        )
      })}
    </ol>
  )
}
