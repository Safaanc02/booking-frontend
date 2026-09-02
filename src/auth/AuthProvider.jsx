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
  /**
   * Contenu du jeton, tenu en état plutôt que relu depuis keycloak.tokenParsed.
   *
   * Une version précédente gardait un simple compteur en dépendance du useMemo
   * pour forcer le recalcul après un rafraîchissement. Le compteur n'était pas
   * lu dans le corps du memo — ESLint le signalait à juste titre, et l'astuce
   * dépendait d'un objet mutable que React ne voit pas. La dépendance est
   * maintenant la donnée elle-même.
   */
  const [profil, setProfil] = useState(null)
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
        setProfil(auth ? keycloak.tokenParsed : null)
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
        .then((refreshed) => { if (refreshed) setProfil(keycloak.tokenParsed) })
        .catch(() => {
          setAuthenticated(false)
          setProfil(null)
        })
    }, INTERVALLE_MS)
    return () => clearInterval(id)
  }, [authenticated])

  const value = useMemo(() => {
    const roles = profil?.realm_access?.roles ?? []
    return {
      ready,
      authenticated,
      roles,
      user: authenticated && profil
        ? {
            id: profil.sub,
            username: profil.preferred_username,
            email: profil.email,
            nom: profil.name,
          }
        : null,
      hasRole: (role) => roles.includes(role),
      /**
       * `locale: "fr"` est explicite à dessein.
       *
       * Keycloak suit l'en-tête Accept-Language du navigateur : un visiteur
       * dont le système est en anglais voyait l'écran de connexion en anglais,
       * au milieu d'un site entièrement en français. Le sélecteur de langue
       * reste disponible sur la page pour qui veut en changer.
       */
      login: (options) => keycloak.login({
        redirectUri: window.location.href,
        locale: "fr",
        ...optionsSures(options),
      }),
      register: () => keycloak.register({ redirectUri: window.location.href, locale: "fr" }),
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
    }
  }, [ready, authenticated, profil])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
