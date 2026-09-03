import { Link, NavLink } from "react-router-dom"
import { useAuth } from "../auth/useAuth"

export default function Header() {
  const { authenticated, user, login, logout, register, hasRole } = useAuth()

  const lien = ({ isActive }) =>
    `text-sm transition ${isActive ? "font-semibold text-brand-700" : "text-stone-600 hover:text-stone-900"}`

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-stone-900">
          Booking<span className="text-brand-600">.ma</span>
        </Link>

        <nav className="flex items-center gap-5">
          <NavLink to="/recherche" className={lien}>Salons</NavLink>
          {/* L'entrée professionnelle ne s'affiche qu'à qui n'en a pas déjà une :
              proposer « Vous êtes un salon ? » à un gérant connecté est absurde.
              Masquée sous 640 px, où elle poussait « Inscription » hors de
              l'écran et faisait défiler la page horizontalement. Le pied de
              page la porte sur toutes les tailles. */}
          {!hasRole("pro") && !hasRole("admin") && (
            <NavLink to="/professionnels" className={(etat) => `hidden sm:block ${lien(etat)}`}>
              Vous êtes un salon ?
            </NavLink>
          )}
          {authenticated && <NavLink to="/compte" className={lien}>Mes réservations</NavLink>}
          {hasRole("pro") && <NavLink to="/mon-planning" className={lien}>Mon planning</NavLink>}
          {hasRole("pro") && <NavLink to="/pro" className={lien}>Mon salon</NavLink>}
          {hasRole("admin") && <NavLink to="/admin" className={lien}>Administration</NavLink>}

          {authenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-stone-500 sm:inline">
                {user?.nom ?? user?.username}
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={login} className="text-sm font-medium text-stone-700 hover:text-stone-900">
                Connexion
              </button>
              <button
                onClick={register}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Inscription
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
