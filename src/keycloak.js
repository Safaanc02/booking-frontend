import Keycloak from "keycloak-js"

/**
 * Instance Keycloak unique de l'application.
 *
 * Il en existait deux auparavant — une dans main.jsx, une ici — toutes deux
 * initialisées en "login-required". Deux init() concurrents sur le même realm
 * se marchent dessus, et "login-required" imposait une connexion avant même
 * de pouvoir consulter la page d'accueil.
 */
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8081",
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? "booking-realm",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "booking-app",
})

export default keycloak
