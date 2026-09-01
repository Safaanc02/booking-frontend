import { useEffect, useMemo, useRef, useState } from "react"
import keycloak from "../keycloak"
import { AuthContext } from "./AuthContext"

/**
 * Écarte tout ce qui n'est pas un objet d'options.
 *
 * `onClick={login}` passe l'événement React en argument, dont les propriétés
 * se retrouvaient étalées dans les options Keycloak — l'URL d'autorisation
 * partait mal formée et la redirection échouait sans le moindre message.
 * Corriger ici plutôt qu'à chaque appel : le prochain `onClick={login}` sera
 * écrit tôt ou tard.
 */
const optionsSures = (options) => {
  if (!options || typeof options !== "object") return {}
  if ("nativeEvent" in options || "currentTarget" in options) return {}
  return options
}

/** Marge de rafraîchissement : on renouvelle si le token expire dans moins de 60 s. */
const MARGE_SECONDES = 60
/** Vérification périodique. L'ancien code appelait updateToken toutes les 6 s — inutilement agressif. */
const INTERVALLE_MS = 30_000

export default function AuthProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [tick, setTick] = useState(0)
  // React 19 en StrictMode monte deux fois : sans ce garde, keycloak.init()
  // serait appelé deux fois et lèverait "A 'Keycloak' instance can only be initialized once".
  const initialise = useRef(false)

  useEffect(() => {
    if (initialise.current) return
    initialise.current = true

    keycloak
      .init({
        // check-sso et non login-required : le visiteur doit pouvoir chercher
        // et consulter les salons sans compte. La connexion n'arrive qu'au
        // moment de confirmer une réservation.
        onLoad: "check-sso",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: "S256",
        checkLoginIframe: false,
      })
      .then((auth) => {
        setAuthenticated(auth)
        setReady(true)
      })
      .catch((err) => {
        // Keycloak injoignable : le site reste consultable en mode visiteur.
        console.error("Initialisation Keycloak impossible", err)
        setReady(true)
      })
  }, [])

  useEffect(() => {
    if (!authenticated) return
    const id = setInterval(() => {
      keycloak
        .updateToken(MARGE_SECONDES)
        .then((refreshed) => { if (refreshed) setTick((t) => t + 1) })
        .catch(() => setAuthenticated(false))
    }, INTERVALLE_MS)
    return () => clearInterval(id)
  }, [authenticated])

  const value = useMemo(() => {
    const roles = keycloak.tokenParsed?.realm_access?.roles ?? []
    return {
      ready,
      authenticated,
      roles,
      user: authenticated
        ? {
            id: keycloak.tokenParsed?.sub,
            username: keycloak.tokenParsed?.preferred_username,
            email: keycloak.tokenParsed?.email,
            nom: keycloak.tokenParsed?.name,
          }
        : null,
      hasRole: (role) => roles.includes(role),
      login: (options) => keycloak.login({ redirectUri: window.location.href, ...optionsSures(options) }),
      register: () => keycloak.register({ redirectUri: window.location.href }),
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
    }
    // `tick` force le recalcul après un rafraîchissement de token.
  }, [ready, authenticated, tick])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
