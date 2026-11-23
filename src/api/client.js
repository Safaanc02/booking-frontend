import axios from "axios"
import keycloak from "../keycloak"

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
  headers: { "Content-Type": "application/json" },
})

/**
 * Le token est lu à chaque requête plutôt que capturé une fois : après un
 * rafraîchissement, une valeur mémorisée serait périmée.
 */
client.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch {
      // Rafraîchissement impossible : on laisse partir la requête, le backend
      // répondra 401 et l'intercepteur de réponse s'en chargera.
    }
    if (keycloak.token) {
      config.headers.Authorization = `Bearer ${keycloak.token}`
    }
  }
  return config
})

/** Normalise les erreurs pour que l'interface n'ait jamais à lire err.response.data.?. */
client.interceptors.response.use(
  (res) => res,
  (error) => {
    const data = error.response?.data
    return Promise.reject({
      status: error.response?.status ?? 0,
      code: data?.code ?? "RESEAU",
      message: data?.message ?? "Le serveur est injoignable",
      details: data?.details ?? null,
    })
  },
)
