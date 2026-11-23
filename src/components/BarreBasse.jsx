import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { Boussole, Horloge } from "./Glyphes"

/**
 * La barre d'onglets du téléphone.
 *
 * L'en-tête à liens débordait dès qu'on était connecté : cinq entrées plus
 * « Déconnexion » sur une ligne de 390 points, la page glissait de 150 px et
 * le bouton sortait de l'écran. Un gérant ouvrait son salon et ne pouvait
 * plus se déconnecter.
 *
 * Quatre onglets sous le pouce, comme WhatsApp et Instagram — les deux
 * applications que les clientes utilisent le plus. On ne leur apprend rien.
 * Pour un gérant : Journée, Agenda, Clients, Salon. Pour une cliente :
 * Accueil, Salons, Rendez-vous, Compte.
 *
 * Masquée dès 768 px, où l'en-tête reprend ses liens, et sur l'écran de
 * réservation, où elle disputerait la place à la barre d'action de la fiche.
 */
const Maison = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" />
  </svg>
)
const Carnet = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="4" width="16" height="17" rx="2.5" /><path d="M8 2.5v3M16 2.5v3M4 9.5h16" />
  </svg>
)
const Personne = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
)
const Gens = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="10" r="2.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M15 19.5a4.5 4.5 0 0 1 6.5-3.5" />
  </svg>
)

export default function BarreBasse() {
  const { authenticated, hasRole } = useAuth()
  const { pathname } = useLocation()

  if (!authenticated || hasRole("admin")) return null
  if (/^\/salon\/\d+\/reserver/.test(pathname)) return null

  const onglets = hasRole("pro")
    ? [
        ["/", "Journée", Maison],
        ["/pro", "Agenda", Carnet],
        ["/mon-planning", "Planning", Horloge],
        ["/compte", "Compte", Personne],
      ]
    : [
        ["/", "Accueil", Maison],
        ["/recherche", "Salons", Boussole],
        ["/compte", "Rendez-vous", Carnet],
        ["/professionnels", "Pro", Gens],
      ]

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-4">
        {onglets.map(([chemin, libelle, Glyphe]) => (
          <li key={chemin}>
            <NavLink
              to={chemin}
              end={chemin === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition ${
                  isActive ? "text-brand-700" : "text-stone-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Glyphe className={`h-6 w-6 ${isActive ? "stroke-[2.2]" : ""}`} />
                  {libelle}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
