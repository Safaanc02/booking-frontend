/**
 * Ce navigateur avait-il une session la dernière fois ?
 *
 * Keycloak met deux à quatre dixièmes de seconde à répondre au chargement.
 * Pendant ce temps il faut bien afficher quelque chose, et les deux réponses
 * possibles se valent mal : montrer la vitrine fait clignoter la page de
 * démarchage sous les yeux de qui est déjà client, montrer une attente fait
 * patienter le visiteur anonyme — le cas courant — devant un rouage vide,
 * pour une vérification qui ne le concerne pas.
 *
 * On tranche donc avec ce que le navigateur sait déjà de lui-même. Ce n'est
 * qu'un indice d'affichage : il ne donne aucun droit, ne contient aucune
 * donnée, et se trompe sans conséquence — au pire, une transition de plus.
 *
 * Tous les accès sont protégés : en navigation privée, ou quand le navigateur
 * refuse le stockage local, la lecture lève au lieu de rendre `null`.
 */
const CLE = "darzin.session"

export function sessionConnue() {
  try {
    return localStorage.getItem(CLE) === "1"
  } catch {
    // Stockage refusé : on retombe sur le cas le plus fréquent, le visiteur.
    return false
  }
}

export function retenirSession(authentifie) {
  try {
    localStorage.setItem(CLE, authentifie ? "1" : "0")
  } catch {
    // Sans mémoire, la page se contente d'une transition de plus au chargement.
  }
}
