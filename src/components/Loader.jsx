export default function Loader({ label = "Chargement…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ titre, children }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <p className="font-medium text-stone-800">{titre}</p>
      {children && <p className="mt-1 text-sm text-stone-500">{children}</p>}
    </div>
  )
}

/**
 * Un refus de droits n'est pas une panne, et n'appelle pas le même geste.
 *
 * L'écran affichait « Accès refusé » et un bouton « Réessayer » — le seul
 * geste qui ne pouvait rien y changer. Un 403 ne s'améliore pas en insistant :
 * soit le compte n'a pas les droits, soit son jeton a été émis avant qu'on
 * les lui donne, et il faut alors un jeton neuf. C'est le cas le plus
 * fréquent après qu'un rôle vient d'être attribué : un rôle n'apparaît que
 * dans un jeton émis après.
 */
export function ErrorState({ erreur, onRetry, onReconnect }) {
  const refus = erreur?.status === 403

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-medium text-red-800">
        {refus
          ? "Votre compte n’a pas accès à cette page"
          : erreur?.message ?? "Une erreur est survenue"}
      </p>
      {refus && (
        <p className="mx-auto mt-2 max-w-sm text-sm text-red-700/90">
          Si vos droits viennent d’être modifiés, reconnectez-vous : ils ne
          figurent que dans une session ouverte après.
        </p>
      )}
      {refus && onReconnect ? (
        <button
          onClick={onReconnect}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Se reconnecter
        </button>
      ) : (
        !refus && onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        )
      )}
    </div>
  )
}
