import { Component } from "react"

/**
 * Ce qui s'affiche quand un composant plante.
 *
 * Sans barrière, une donnée inattendue qui fait lever une exception dans un
 * rendu effaçait toute la page : blanc, sans message, sans bouton. La cliente
 * croyait le site mort. Ici, le reste de la page survit, et l'on dit ce qui
 * s'est passé avec un moyen d'en sortir.
 *
 * Classe et non fonction : React n'offre les barrières d'erreur qu'ainsi.
 */
export default class BarriereErreur extends Component {
  constructor(props) {
    super(props)
    this.state = { cassee: false }
  }

  static getDerivedStateFromError() {
    return { cassee: true }
  }

  componentDidCatch(erreur, info) {
    // La console reste le seul journal côté navigateur : qu'au moins elle
    // dise où, et non seulement quoi.
    console.error("Rendu interrompu :", erreur, info?.componentStack)
  }

  render() {
    if (!this.state.cassee) return this.props.children
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Quelque chose a cassé</h1>
        <p className="mt-2 text-sm text-stone-600">
          Cette partie de la page n'a pas pu s'afficher. Recharger suffit en général ;
          si ça se reproduit, le reste du site fonctionne.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Recharger
          </button>
          <a href="/" className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Accueil
          </a>
        </div>
      </div>
    )
  }
}
