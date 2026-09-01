import { Link } from "react-router-dom"
import { telephone } from "../lib/format"

export default function SalonCard({ salon }) {
  return (
    <Link
      to={`/salon/${salon.id}`}
      className="group block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:shadow-md hover:ring-brand-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-stone-900 group-hover:text-brand-700">
            {salon.nom}
          </h3>
          <p className="mt-1 truncate text-sm text-stone-500">{salon.adresse}</p>
        </div>
        {salon.ville && (
          <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {salon.ville}
          </span>
        )}
      </div>
      {salon.telephone && (
        <p className="mt-3 text-sm text-stone-400">{telephone(salon.telephone)}</p>
      )}
    </Link>
  )
}
