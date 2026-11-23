import { Link, useLocation } from "react-router-dom"

/**
 * Coquille commune aux trois textes légaux.
 *
 * Ils se lisent ensemble : un salon qui vérifie qui édite le site enchaîne sur
 * ce qu'il signe, une cliente qui lit les conditions veut savoir ce qu'on fait
 * de son numéro. Les séparer sans les relier revient à les cacher.
 *
 * L'avertissement en tête est délibéré tant que la société n'est pas
 * constituée : un texte qui prétend engager une personne morale inexistante
 * n'engage rien, et le découvrir en rendez-vous coûte plus cher que de l'avoir
 * écrit.
 */

const PAGES = [
  ["/mentions-legales", "Mentions légales"],
  ["/conditions", "Conditions d'utilisation"],
  ["/confidentialite", "Données personnelles"],
]

export default function PageLegale({ titre, maj, children }) {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="flex flex-wrap gap-2">
        {PAGES.map(([chemin, libelle]) => (
          <Link
            key={chemin}
            to={chemin}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              pathname === chemin
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-100"
            }`}
          >
            {libelle}
          </Link>
        ))}
      </nav>

      <h1 className="mt-8 text-2xl font-bold text-stone-900">{titre}</h1>
      {maj && <p className="mt-1 text-xs text-stone-400">Dernière mise à jour : {maj}</p>}

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-stone-700">{children}</div>
    </div>
  )
}

export function Bloc({ titre, children }) {
  return (
    <section>
      <h2 className="font-semibold text-stone-900">{titre}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  )
}

/** Ce qui attend une donnée que seule la société pourra fournir. */
export function AComplete({ children }) {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-200">
      {children}
    </span>
  )
}
