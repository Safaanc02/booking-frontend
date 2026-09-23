import { Link, NavLink } from "react-router-dom"
import { useAuth } from "../auth/useAuth"

export default function Header() {
  const { authenticated, user, login, logout, register, hasRole } = useAuth()

  const lien = ({ isActive }) =>
    `text-sm transition ${isActive ? "font-semibold text-brand-700" : "text-stone-600 hover:text-stone-900"}`

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        {/*
          Le symbole et le mot, pas seulement le mot.
          Le symbole seul serait illisible pour qui découvre la marque ; le mot
          seul perdrait ce qui la rend reconnaissable en petit. Le symbole est
          décoratif pour un lecteur d'écran — le nom est écrit juste à côté, et
          l'annoncer deux fois n'apprend rien.
        */}
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/logo-darzin.png"
            alt=""
            aria-hidden
            width="32"
            height="32"
            className="h-8 w-8 shrink-0"
          />
          <span className="text-lg font-bold tracking-tight text-brand-700">darzin</span>
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
          {/* Pas pour l'équipe : un administrateur n'est pas un client, il ne
              réserve pas. L'entrée le menait vers une page toujours vide, et
              donnait à son écran l'allure de celui d'une cliente — alors que
              c'est un poste de travail, pas un compte de particulier.
              Un gérant la garde : il peut très bien réserver ailleurs. */}
          {authenticated && !hasRole("admin") && (
            <NavLink to="/compte" className={lien}>Mes réservations</NavLink>
          )}
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
