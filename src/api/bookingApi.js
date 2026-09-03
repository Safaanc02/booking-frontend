import { client } from "./client"

/** Routes publiques — aucun token requis. */
export const publicApi = {
  /**
   * Recherche publique.
   *
   * `metier` est filtré par le serveur, sur l'ensemble des métiers exercés.
   * L'interface le faisait sur la page reçue, si bien qu'un filtre ne voyait
   * que les vingt premiers résultats.
   */
  rechercherSalons: ({ ville, q, metier, page = 0, size = 20 } = {}) =>
    client
      .get("/api/public/salons", {
        params: {
          ville: ville || undefined,
          q: q || undefined,
          metier: metier || undefined,
          page,
          size,
        },
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

  avis: (salonId, { page = 0, size = 10 } = {}) =>
    client.get(`/api/public/salons/${salonId}/avis`, { params: { page, size } }).then((r) => r.data),
}

/**
 * Prise de contact d'un professionnel.
 *
 * Route publique et sans compte : dans ce modèle, un salon ne s'inscrit pas,
 * il est installé par l'équipe. Ce formulaire remplit la file commerciale.
 */
export const proprietairesApi = {
  demanderDemo: (payload) =>
    client.post("/api/public/demandes-demo", payload).then((r) => r.data),
}

/** Annulation depuis un email : aucun jeton d'authentification, un lien signé. */
export const annulationApi = {
  apercu: (token) =>
    client.get("/api/public/reservations/apercu", { params: { token } }).then((r) => r.data),
  // POST et non GET : les clients de messagerie préchargent les liens GET.
  confirmer: (token) =>
    client.post("/api/public/reservations/annuler", null, { params: { token } }).then((r) => r.data),
}

export const avisApi = {
  deposer: (payload) => client.post("/api/avis", payload).then((r) => r.data),
  repondre: (avisId, reponse) =>
    client.post(`/api/pro/avis/${avisId}/reponse`, { reponse }).then((r) => r.data),
}

export const reservationsApi = {
  mesReservations: () => client.get("/api/reservations/me").then((r) => r.data),
  creer: (payload) => client.post("/api/reservations", payload).then((r) => r.data),
  annuler: (id) => client.patch(`/api/reservations/${id}/annuler`).then((r) => r.data),
}

export const salonsApi = {
  mesSalons: () => client.get("/api/salons/me").then((r) => r.data),
  modifier: (id, payload) => client.put(`/api/salons/${id}`, payload).then((r) => r.data),
}

export const prestationsApi = {
  parSalon: (salonId) => client.get(`/api/prestations/salon/${salonId}`).then((r) => r.data),
  creer: (salonId, payload) => client.post(`/api/prestations/salon/${salonId}`, payload).then((r) => r.data),
}

export const proApi = {
  /* Agenda */
  agenda: (salonId, { date, jours = 1 } = {}) =>
    client.get(`/api/pro/salons/${salonId}/agenda`, { params: { date, jours } }).then((r) => r.data),
  /** Rendez-vous pris par téléphone ou au comptoir, pour un client sans compte. */
  creerReservation: (salonId, payload) =>
    client.post(`/api/pro/salons/${salonId}/reservations`, payload).then((r) => r.data),
  changerStatut: (reservationId, statut) =>
    client.patch(`/api/pro/reservations/${reservationId}/statut`, null, { params: { statut } }).then((r) => r.data),

  /** Planning personnel du compte connecté, tous salons confondus. */
  monPlanning: ({ date, jours = 1 } = {}) =>
    client.get('/api/pro/mon-planning', { params: { date, jours } }).then((r) => r.data),

  /* Équipe */
  employes: (salonId) => client.get(`/api/pro/salons/${salonId}/employes`).then((r) => r.data),
  creerEmploye: (salonId, payload) =>
    client.post(`/api/pro/salons/${salonId}/employes`, payload).then((r) => r.data),
  modifierEmploye: (employeId, payload) =>
    client.put(`/api/pro/employes/${employeId}`, payload).then((r) => r.data),
  desactiverEmploye: (employeId) => client.delete(`/api/pro/employes/${employeId}`),
  affecterPrestations: (employeId, prestationIds) =>
    client.put(`/api/pro/employes/${employeId}/prestations`, { prestationIds }),

  /* Horaires */
  horaires: (salonId) => client.get(`/api/pro/salons/${salonId}/horaires`).then((r) => r.data),
  definirHoraires: (salonId, semaine) =>
    client.put(`/api/pro/salons/${salonId}/horaires`, semaine).then((r) => r.data),

  /* Absences */
  creerAbsence: (payload) => client.post("/api/pro/absences", payload).then((r) => r.data),
}

export const adminApi = {
  /** File de validation. `statut` : EN_ATTENTE, ACTIF ou SUSPENDU. */
  salons: (statut = "EN_ATTENTE", page = 0) =>
    client.get("/api/admin/salons", { params: { statut, page, size: 50 } }).then((r) => r.data),
  changerStatut: (salonId, statut) =>
    client.patch(`/api/admin/salons/${salonId}/statut`, null, { params: { statut } }).then((r) => r.data),
  /**
   * Référence un salon pour le compte d'un gérant.
   *
   * Un seul appel crée le compte, attribue le rôle professionnel, crée le
   * salon à son nom et envoie l'invitation à définir un mot de passe.
   */
  referencerSalon: (payload) =>
    client.post("/api/admin/salons", payload).then((r) => r.data),

  /** File commerciale. `statut` : NOUVELLE, CONTACTEE, QUALIFIEE, CONVERTIE, PERDUE. */
  demandes: (statut = "NOUVELLE", page = 0) =>
    client.get("/api/admin/demandes-demo", { params: { statut, page, size: 50 } })
      .then((r) => r.data),
  nouvellesDemandes: () =>
    client.get("/api/admin/demandes-demo/nouvelles").then((r) => r.data),
  traiterDemande: (id, statut, note) =>
    client.patch(`/api/admin/demandes-demo/${id}`, null, { params: { statut, note } })
      .then((r) => r.data),

  avis: (statut = "PUBLIE", page = 0) =>
    client.get("/api/admin/avis", { params: { statut, page, size: 50 } }).then((r) => r.data),
  modererAvis: (avisId, statut) =>
    client.patch(`/api/admin/avis/${avisId}/statut`, null, { params: { statut } }).then((r) => r.data),
}
