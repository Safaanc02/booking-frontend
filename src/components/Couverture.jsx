import { useState } from "react"
import { couleursSalon } from "../lib/identiteSalon"
import { urlApi } from "../lib/format"
import { TrameZellige } from "./Motifs"
import { Coiffure, Barbier, Onglerie, Esthetique, Hammam } from "./Glyphes"

/**
 * Bandeau d'identité d'un salon.
 *
 * Rien n'est chargé : dégradé, trame de zellige et pictogramme du métier sont
 * dessinés. C'est ce qui permet de le mettre partout — liste de résultats,
 * fiche, tunnel — sans peser sur une connexion mobile. Les teintes viennent
 * de lib/identiteSalon, qui explique pourquoi elles sont ce qu'elles sont.
 */
const GLYPHES = {
  COIFFURE: Coiffure, BARBIER: Barbier, ONGLERIE: Onglerie,
  ESTHETIQUE: Esthetique, SPA: Hammam,
}

export default function Couverture({ salon, hauteur = "h-32", className = "", children }) {
  const { sombre, clair, ancrage } = couleursSalon(salon)
  const Glyphe = GLYPHES[salon?.categorie] ?? Coiffure
  // L'identifiant du motif doit être unique dans la page : plusieurs
  // couvertures cohabitent dans une liste, et deux <pattern> de même id
  // feraient tous pointer sur le premier.
  const id = `couverture-${salon?.id ?? "x"}`

  /*
   * La photo si le salon en a déposé une, l'identité dessinée sinon.
   *
   * Le dégradé reste sous l'image, et pas seulement par principe : il tient la
   * place pendant le chargement, et il reste visible si la photo ne vient
   * jamais — répertoire vidé par un redéploiement, réseau coupé. Une carte au
   * cadre gris et cassé ferait plus de tort qu'une carte sans photo.
   */
  const photo = urlApi(salon?.photos?.[0])
  const [photoCassee, setPhotoCassee] = useState(false)

  return (
    <div
      className={`relative isolate overflow-hidden ${hauteur} ${className}`}
      style={{ background: `linear-gradient(135deg, ${sombre} 0%, ${clair} 100%)` }}
    >
      {photo && !photoCassee ? (
        <img
          src={photo}
          alt=""
          // Décorative : le nom du salon est écrit juste en dessous, et le
          // lire deux fois de suite à un lecteur d'écran n'apprend rien.
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={() => setPhotoCassee(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <TrameZellige
            id={id}
            taille={104}
            className="pointer-events-none absolute h-[190%] w-[190%] text-white/25"
            style={{ inset: ancrage }}
          />
          {/* Le pictogramme déborde et reste très pâle : il donne une texture
              et une indication de métier sans disputer la place au nom. */}
          <Glyphe className="pointer-events-none absolute -bottom-5 -right-3 h-28 w-28 text-white/20" />
        </>
      )}
      {/*
        Voile sous les pastilles quand une photo est présente.

        Les pastilles de note, de métier et de distance sont posées sur un fond
        maîtrisé quand il est dessiné ; sur une photo, il peut être blanc, clair
        ou chargé, et un texte blanc y devient illisible. Le voile ne se met
        que là où il sert.
      */}
      {photo && !photoCassee && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/25"
        />
      )}
      {children}
    </div>
  )
}

/**
 * Pastille d'initiales, pour les membres d'équipe.
 *
 * Les fiches n'ont pas de portrait : les cadres vides de la rubrique
 * « L'équipe » ne disaient rien de plus que le nom écrit juste à côté.
 */
export function Initiales({ prenom = "", nom = "", categorie = "COIFFURE", taille = "h-11 w-11" }) {
  const { sombre, clair } = couleursSalon({ nom: `${prenom}${nom}`, categorie })
  const lettres = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || "?"
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${taille}`}
      style={{ background: `linear-gradient(135deg, ${sombre}, ${clair})` }}
    >
      {lettres}
    </span>
  )
}
