import { useEffect, useRef } from "react"
import { useAuth } from "../auth/useAuth"
import Loader from "./Loader"

/**
 * Adresse portée par le lien d'invitation, le cas échéant.
 *
 * Le gérant arrive ici depuis l'e-mail où il vient de choisir son mot de
 * passe. Keycloak n'ouvre pas de session au terme d'une action envoyée par
 * courrier : sans ce raccourci, il tombe sur un écran « Connectez-vous » et
 * doit ressaisir l'identifiant qu'il utilisait à l'instant.
 */
const bienvenue = () => {
  const valeur = new URLSearchParams(window.location.search).get("bienvenue")
  return valeur && valeur.includes("@") ? valeur : null
}

/** L'adresse ne reste pas dans la barre d'URL ni dans l'historique. */
const urlNettoyee = () => {
  const u = new URL(window.location.href)
  u.searchParams.delete("bienvenue")
  return u.toString()
}

/**
 * Garde de route côté interface.
 *
 * Purement ergonomique : elle évite d'afficher un écran vide à qui n'a rien à
 * y faire. La vraie autorisation est celle du backend, qui ne fait aucune
 * confiance à ce qui vient du navigateur.
 */
export default function RequireRole({ role, children }) {
  const { ready, authenticated, hasRole, login } = useAuth()
  const invitation = bienvenue()
  // Une seule tentative : la redirection quitte la page, mais un retour
  // arrière ramènerait ici avec le même paramètre.
  const amorce = useRef(false)

  useEffect(() => {
    if (!ready || authenticated || !invitation || amorce.current) return
    amorce.current = true
    login({ loginHint: invitation, redirectUri: urlNettoyee() })
  }, [ready, authenticated, invitation, login])

  if (!ready || (!authenticated && invitation)) return <Loader />

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
