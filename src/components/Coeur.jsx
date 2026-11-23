import { useEffect, useState } from "react"
import { useAuth } from "../auth/useAuth"
import { abonner, basculerFavori } from "../lib/favoris"

/**
 * Le cœur : garder un salon.
 *
 * Posé sur chaque carte et sur la fiche. Invisible pour qui n'est pas
 * connecté — un cœur qui ouvre un écran de connexion est une promesse qu'on
 * ne tient pas tout de suite ; on le montre quand il peut agir.
 *
 * `stopPropagation` : sur une carte, le cœur vit à l'intérieur d'un lien, et
 * un clic dessus ne doit pas ouvrir la fiche.
 */
export default function Coeur({ salonId, taille = "h-9 w-9", className = "" }) {
  const { authenticated, hasRole } = useAuth()
  const [garde, setGarde] = useState(false)

  useEffect(() => {
    if (!authenticated) return undefined
    return abonner((ids) => setGarde(ids.has(salonId)))
  }, [authenticated, salonId])

  if (!authenticated || hasRole("admin")) return null

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); basculerFavori(salonId) }}
      aria-pressed={garde}
      aria-label={garde ? "Retirer de mes salons" : "Garder ce salon"}
      title={garde ? "Dans mes salons" : "Garder ce salon"}
      className={`grid ${taille} place-items-center rounded-full bg-white/95 shadow-sm backdrop-blur transition hover:scale-105 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={garde ? "#dc586d" : "none"} stroke={garde ? "#dc586d" : "#6b4a5f"} strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
    </button>
  )
}
