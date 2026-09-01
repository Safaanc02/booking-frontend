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

export function ErrorState({ erreur, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-medium text-red-800">{erreur?.message ?? "Une erreur est survenue"}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
