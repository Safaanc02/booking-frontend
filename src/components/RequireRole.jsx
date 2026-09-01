import { useAuth } from "../auth/useAuth"
import Loader from "./Loader"

/**
 * Garde de route côté interface.
 *
 * Purement ergonomique : elle évite d'afficher un écran vide à qui n'a rien à
 * y faire. La vraie autorisation est celle du backend, qui ne fait aucune
 * confiance à ce qui vient du navigateur.
 */
export default function RequireRole({ role, children }) {
  const { ready, authenticated, hasRole, login } = useAuth()

  if (!ready) return <Loader />

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Espace professionnel</h1>
        <p className="mt-2 text-sm text-stone-600">Connectez-vous pour gérer votre salon.</p>
        <button
          onClick={login}
          className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Se connecter
        </button>
      </div>
    )
  }

  if (role && !hasRole(role) && !hasRole("admin")) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Accès réservé aux professionnels</h1>
        <p className="mt-2 text-sm text-stone-600">
          Votre compte n'a pas le rôle nécessaire. Contactez-nous pour référencer votre salon.
        </p>
      </div>
    )
  }

  return children
}
