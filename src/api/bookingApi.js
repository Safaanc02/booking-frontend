import { client } from "./client"

/** Routes publiques — aucun token requis. */
export const publicApi = {
  rechercherSalons: ({ ville, q, page = 0, size = 20 } = {}) =>
    client
      .get("/api/public/salons", { params: { ville: ville || undefined, q: q || undefined, page, size } })
      .then((r) => r.data),

  ficheSalon: (id) => client.get(`/api/public/salons/${id}`).then((r) => r.data),

  villes: () => client.get("/api/public/villes").then((r) => r.data),
}

/** Routes authentifiées. */
export const salonsApi = {
  creer: (payload) => client.post("/api/salons", payload).then((r) => r.data),
  modifier: (id, payload) => client.put(`/api/salons/${id}`, payload).then((r) => r.data),
  supprimer: (id) => client.delete(`/api/salons/${id}`),
}

export const prestationsApi = {
  parSalon: (salonId) => client.get(`/api/prestations/salon/${salonId}`).then((r) => r.data),
  creer: (salonId, payload) => client.post(`/api/prestations/salon/${salonId}`, payload).then((r) => r.data),
  modifier: (id, payload) => client.put(`/api/prestations/${id}`, payload).then((r) => r.data),
  supprimer: (id) => client.delete(`/api/prestations/${id}`),
}

export const reservationsApi = {
  mesReservations: () => client.get("/api/reservations/me").then((r) => r.data),
  creer: (payload) => client.post("/api/reservations", payload).then((r) => r.data),
  annuler: (id) => client.delete(`/api/reservations/${id}`),
}
