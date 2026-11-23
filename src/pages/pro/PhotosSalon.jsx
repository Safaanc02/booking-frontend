import { useCallback, useEffect, useRef, useState } from "react"
import { proApi } from "../../api/bookingApi"
import { urlApi } from "../../lib/format"

/**
 * Les photos du salon.
 *
 * Une identité visuelle engendrée depuis le nom tenait la place — dégradé,
 * zellige, pictogramme du métier —, et elle reste le repli. C'est bien mieux
 * qu'un cadre vide pour un salon qu'on vient d'installer. Mais une photo vend
 * ce qu'un dégradé ne vendra jamais.
 *
 * La première photo sert de couverture partout : liste de résultats, fiche,
 * tunnel. L'écran le dit et permet de la changer, parce que l'ordre d'envoi
 * n'est presque jamais l'ordre qu'on veut montrer — on photographie l'intérieur
 * avant de penser à la devanture.
 */
export default function PhotosSalon({ salon }) {
  const [liste, setListe] = useState([])
  const [etat, setEtat] = useState("chargement")
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null })
  const champ = useRef(null)

  const charger = useCallback(() => {
    proApi.photos(salon.id)
      .then((p) => { setListe(p ?? []); setEtat("ok") })
      .catch(() => setEtat("erreur"))
  }, [salon.id])

  useEffect(charger, [charger])

  const deposer = async (fichiers) => {
    setEnvoi({ enCours: true, erreur: null })
    try {
      // Une par une, et non toutes ensemble : le serveur plafonne le nombre
      // par salon, et un envoi groupé qui dépasse la limite au troisième
      // fichier échouerait en bloc, y compris pour les deux premiers.
      for (const f of fichiers) {
        await proApi.deposerPhoto(salon.id, f)
      }
      setEnvoi({ enCours: false, erreur: null })
    } catch (erreur) {
      setEnvoi({ enCours: false, erreur })
    }
    if (champ.current) champ.current.value = ""
    charger()
  }

  const supprimer = (id) => {
    proApi.supprimerPhoto(id).then(charger).catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  const mettreEnCouverture = (id) => {
    const ordre = [id, ...liste.filter((p) => p.id !== id).map((p) => p.id)]
    proApi.ordonnerPhotos(salon.id, ordre).then(charger)
      .catch((erreur) => setEnvoi({ enCours: false, erreur }))
  }

  return (
    <fieldset className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
        Vos photos
      </legend>
      <p className="mt-2 text-sm text-stone-500">
        La première sert de couverture, partout où votre salon apparaît. Sans photo,
        un motif est dessiné à partir de votre nom — mieux qu'un cadre vide, moins
        parlant qu'une devanture.
      </p>

      {etat === "ok" && liste.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {liste.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-xl ring-1 ring-stone-200">
              <img
                src={urlApi(p.url)}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-28 w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-stone-900 shadow-sm">
                  Couverture
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                {i > 0 ? (
                  <button
                    type="button"
                    onClick={() => mettreEnCouverture(p.id)}
                    className="rounded-lg bg-white/95 px-2 py-1 text-[11px] font-medium text-stone-800 hover:bg-white"
                  >
                    Mettre en couverture
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => supprimer(p.id)}
                  className="rounded-lg bg-white/95 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-white"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-brand-300 hover:text-brand-700">
          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => deposer([...e.target.files])}
          />
          {envoi.enCours ? "Envoi…" : "Ajouter des photos"}
        </label>
        <span className="text-xs text-stone-500">
          JPEG, PNG ou WebP · 5 Mo au plus · 6 photos par salon
        </span>
      </div>

      {envoi.erreur && (
        <p role="alert" className="mt-3 text-sm text-red-700">{envoi.erreur.message}</p>
      )}
      {etat === "erreur" && (
        <p className="mt-3 text-sm text-stone-600">
          Vos photos n’ont pas pu être chargées.{" "}
          <button type="button" onClick={charger} className="font-medium text-brand-700 underline underline-offset-4">
            Réessayer
          </button>
        </p>
      )}
    </fieldset>
  )
}
