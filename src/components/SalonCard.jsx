import { Link } from "react-router-dom"
import { prix as formatPrix } from "../lib/format"
import Couverture from "./Couverture"

const METIERS = {
  COIFFURE: "Coiffure", BARBIER: "Barbier", ONGLERIE: "Onglerie",
  ESTHETIQUE: "Esthétique", SPA: "Hammam & spa",
}

/**
 * Carte d'un salon dans une liste de résultats.
 *
 * Elle ne montrait qu'un nom, une adresse, une note et un numéro de
 * téléphone — quatre lignes de texte gris dans un cadre blanc. Trois choses
 * ont changé :
 *
 *   • un bandeau d'identité, calculé depuis le nom. Sans photo, un cadre vide
 *     donne l'air d'un site en travaux ; le dégradé et le pictogramme du
 *     métier se reconnaissent d'un coup d'œil.
 *
 *   • le prix d'entrée à la place du téléphone. Le numéro était l'information
 *     la moins utile de la carte, et la plus contradictoire : tout le produit
 *     consiste à ne plus décrocher. Un tarif aide à choisir.
 *
 *   • le métier écrit. « Nails & Co » ne dit pas à tout le monde qu'on y fait
 *     les ongles.
 *
 * Un salon sans avis est annoncé « Nouveau » à la place de la note, et non
 * « Pas encore d'avis » sur la ligne du prix : la formule négative
 * désalignait les cartes entre elles, et l'absence de note se lit mieux comme
 * une nouveauté que comme un manque.
 *
 * La ville disparaît quand la recherche la filtre déjà : dans une liste
 * « Casablanca », l'étiquette Casablanca sur chaque carte n'apprend rien.
 */
export default function SalonCard({ salon, villeFiltree = false }) {
  const note = salon.noteMoyenne && salon.nombreAvis
  const lieu = [salon.quartier, villeFiltree ? null : salon.ville].filter(Boolean).join(" · ")

  return (
    <Link
      to={`/salon/${salon.id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-carte-levee hover:ring-brand-300"
    >
      <Couverture salon={salon} hauteur="h-28">
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-900 shadow-sm backdrop-blur">
          {note ? (
            <>
              <span className="text-amber-500">★</span>
              <span className="tabular-nums">
                {Number(salon.noteMoyenne).toFixed(1).replace(".", ",")}
              </span>
              <span className="font-normal text-stone-400">({salon.nombreAvis})</span>
            </>
          ) : (
            <span className="font-medium text-stone-500">Nouveau</span>
          )}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
          {METIERS[salon.categorie] ?? salon.categorie}
        </span>
      </Couverture>

      <div className="p-4">
        <h3 className="truncate text-[17px] font-semibold text-stone-900 transition group-hover:text-brand-700">
          {salon.nom}
        </h3>
        <p className="mt-0.5 truncate text-sm text-stone-500">
          {salon.adresse}
          {lieu && <span className="text-stone-400"> · {lieu}</span>}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
          {salon.prixMin != null ? (
            <span className="text-sm text-stone-600">
              dès <strong className="font-semibold tabular-nums text-stone-900">
                {formatPrix(salon.prixMin)}
              </strong>
            </span>
          ) : (
            /* Catalogue encore vide : le salon vient d'être référencé. */
            <span className="text-sm text-stone-400">Catalogue en préparation</span>
          )}
          <span className="text-sm font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
            Réserver →
          </span>
        </div>
      </div>
    </Link>
  )
}
