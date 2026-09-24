import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"

/**
 * L'initialisation de Keycloak vit dans AuthProvider, pas ici.
 *
 * L'ancien main.jsx créait sa propre instance Keycloak, l'initialisait en
 * "login-required" et ne rendait <App/> qu'une fois authentifié — sans jamais
 * monter AuthProvider. App.jsx lisait pourtant AuthContext : le destructuring
 * d'un contexte undefined plantait l'application au démarrage.
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
