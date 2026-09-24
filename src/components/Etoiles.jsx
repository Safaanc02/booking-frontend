/**
 * Note en étoiles.
 *
 * En lecture seule, c'est un simple affichage. En saisie, ce sont de vrais
 * boutons radio masqués : un composant de notation fait de <div> cliquables
 * est inutilisable au clavier et invisible pour un lecteur d'écran.
 */
export default function Etoiles({ note, taille = "sm", onChange, name = "note" }) {
  const tailles = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }
  const classe = tailles[taille] ?? tailles.sm

  if (!onChange) {
    return (
      <span className={`${classe} tracking-tight text-amber-500`} aria-label={`${note} sur 5`}>
        {"★".repeat(Math.round(note))}
        <span className="text-stone-300">{"★".repeat(5 - Math.round(note))}</span>
      </span>
    )
  }

  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">Votre note</legend>
      {[1, 2, 3, 4, 5].map((v) => (
        <label key={v} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v}
            checked={note === v}
            onChange={() => onChange(v)}
            className="peer sr-only"
          />
          <span
            className={`${classe} transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-500 ${
              v <= note ? "text-amber-500" : "text-stone-300 hover:text-amber-300"
            }`}
          >
            ★
          </span>
          <span className="sr-only">{v} sur 5</span>
        </label>
      ))}
    </fieldset>
  )
}

/** « 4,8 · 27 avis », ou rien du tout si le salon n'a pas encore été noté. */
export function NoteResume({ moyenne, nombre, classe = "" }) {
  if (!moyenne || !nombre) {
    return <span className={`text-sm text-stone-400 ${classe}`}>Pas encore d'avis</span>
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${classe}`}>
      <span className="text-amber-500">★</span>
      <span className="font-semibold text-stone-900">
        {Number(moyenne).toFixed(1).replace(".", ",")}
      </span>
      <span className="text-stone-400">· {nombre} avis</span>
    </span>
  )
}
