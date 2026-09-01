import { client } from "./client"

/** Routes publiques — aucun token requis. */
export const publicApi = {
  rechercherSalons: ({ ville, q, page = 0, size = 20 } = {}) =>
    client
      .get("/api/public/salons", {
        params: { ville: ville || undefined, q: q || undefined, page, size },
      })
      .then((r) => r.data),

  ficheSalon: (id) => client.get(`/api/public/salons/${id}`).then((r) => r.data),

  /** Praticiens sachant réaliser cette prestation, avec leur durée effective. */
  employesPour: (salonId, prestationId) =>
    client
      .get(`/api/public/salons/${salonId}/employes`, { params: { prestationId } })
      .then((r) => r.data),

  /** `date` au format AAAA-MM-JJ. `employeId` nul = sans préférence. */
  disponibilites: (salonId, { prestationId, date, employeId } = {}) =>
    client
      .get(`/api/public/salons/${salonId}/disponibilites`, {
        params: { prestationId, date, employeId: employeId || undefined },
      })
      .then((r) => r.data),

  /** Les prochains jours ayant au moins un créneau — évite de cliquer sur des jours vides. */
  prochainesDispos: (salonId, { prestationId, employeId, jours = 14 } = {}) =>
    client
      .get(`/api/public/salons/${salonId}/prochaines-dispos`, {
        params: { prestationId, employeId: employeId || undefined, jours },
      })
      .then((r) => r.data),

  villes: () => client.get("/api/public/villes").then((r) => r.data),
}

export const reservationsApi = {
  mesReservations: () => client.get("/api/reservations/me").then((r) => r.data),
  creer: (payload) => client.post("/api/reservations", payload).then((r) => r.data),
  annuler: (id) => client.patch(`/api/reservations/${id}/annuler`).then((r) => r.data),
}

export const salonsApi = {
  mesSalons: () => client.get("/api/salons/me").then((r) => r.data),
  creer: (payload) => client.post("/api/salons", payload).then((r) => r.data),
  modifier: (id, payload) => client.put(`/api/salons/${id}`, payload).then((r) => r.data),
}

export const prestationsApi = {
  parSalon: (salonId) => client.get(`/api/prestations/salon/${salonId}`).then((r) => r.data),
  creer: (salonId, payload) => client.post(`/api/prestations/salon/${salonId}`, payload).then((r) => r.data),
}

export const proApi = {
  employes: (salonId) => client.get(`/api/pro/salons/${salonId}/employes`).then((r) => r.data),
  creerEmploye: (salonId, payload) => client.post(`/api/pro/salons/${salonId}/employes`, payload).then((r) => r.data),
  affecterPrestations: (employeId, prestationIds) =>
    client.put(`/api/pro/employes/${employeId}/prestations`, { prestationIds }),
  horaires: (salonId) => client.get(`/api/pro/salons/${salonId}/horaires`).then((r) => r.data),
  definirHoraires: (salonId, semaine) =>
    client.put(`/api/pro/salons/${salonId}/horaires`, semaine).then((r) => r.data),
}
