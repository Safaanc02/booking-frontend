import { useState } from "react"
import { Link, NavLink } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { choisirSoiree, preferenceSoiree, estLaSoiree } from "../lib/maroc"

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

        {/* Les liens ne s'affichent qu'à partir de 768 px. En dessous, la
            barre basse (BarreBasse) les porte : l'en-tête débordait dès qu'on
            était connecté, et « Déconnexion » sortait de l'écran. */}
        <nav className="hidden items-center gap-5 md:flex">
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

        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Soiree />
          {authenticated ? (
            <>
              <span className="hidden text-sm text-stone-500 lg:inline">
                {user?.nom ?? user?.username}
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <button onClick={login} className="text-sm font-medium text-stone-700 hover:text-stone-900">
                Connexion
              </button>
              <button
                onClick={register}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Inscription
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * L'interrupteur de soirée.
 *
 * Le site passe seul en soirée après 20 h à Casablanca ; la personne peut
 * forcer le jour ou la soirée, et sa préférence est gardée dans le navigateur.
 * Trois états : automatique, jour, soirée. Le bouton affiche ce qu'il fera au
 * prochain clic, pas ce qui est.
 */
function Soiree() {
  const [pref, setPref] = useState(preferenceSoiree)
  const sombre = pref === "soiree" || (pref === "auto" && estLaSoiree())
  const suivant = sombre ? "jour" : "soiree"
  return (
    <button
      type="button"
      onClick={() => { choisirSoiree(suivant); setPref(suivant) }}
      aria-label={sombre ? "Passer en mode jour" : "Passer en soirée"}
      title={pref === "auto" ? "Suit l'heure de Casablanca" : sombre ? "Soirée" : "Jour"}
      className="grid h-9 w-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
    >
      {sombre ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  )
}
