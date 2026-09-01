import { Link } from "react-router-dom"
import SearchBar from "../components/SearchBar"

const CATEGORIES = [
  { cle: "coiffure",   libelle: "Coiffure",   emoji: "💇" },
  { cle: "barbier",    libelle: "Barbier",    emoji: "💈" },
  { cle: "onglerie",   libelle: "Onglerie",   emoji: "💅" },
  { cle: "esthetique", libelle: "Esthétique", emoji: "✨" },
  { cle: "hammam",     libelle: "Hammam & spa", emoji: "🛁" },
]

export default function Home() {
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-stone-50 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Réservez votre salon,<br className="hidden sm:block" /> à toute heure
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-stone-600">
            Coiffure, barbier, onglerie, hammam — trouvez un créneau près de chez vous
            et réservez en ligne, même quand le salon est fermé.
          </p>
          <div className="mt-8">
            <SearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-lg font-semibold text-stone-900">Par catégorie</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.cle}
              to={`/recherche?q=${c.libelle}`}
              className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-stone-200 transition hover:shadow-md hover:ring-brand-200"
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="mt-2 text-sm font-medium text-stone-800">{c.libelle}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            ["Réservez 24h/24", "Plus besoin d'appeler pendant les heures d'ouverture."],
            ["Prix affichés", "Vous savez ce que vous payez avant de réserver."],
            ["Rappel avant le rendez-vous", "Un message la veille, pour ne rien oublier."],
          ].map(([titre, texte]) => (
            <div key={titre} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
              <p className="font-semibold text-stone-900">{titre}</p>
              <p className="mt-1 text-sm text-stone-600">{texte}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
