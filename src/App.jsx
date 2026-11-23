import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import AuthProvider from "./auth/AuthProvider"
import Header from "./components/Header"
import BarreBasse from "./components/BarreBasse"
import BarriereErreur from "./components/BarriereErreur"
import Loader from "./components/Loader"
import { appliquerSoiree } from "./lib/maroc"
import Accueil from "./pages/Home"
import Results from "./pages/Results"
import SalonDetails from "./pages/SalonDetails"
import Reservation from "./pages/Reservation"
import AnnulationParLien from "./pages/AnnulationParLien"
import RequireRole from "./components/RequireRole"
import Professionnels from "./pages/Professionnels"
import Account from "./pages/Account"
import NotFound from "./pages/NotFound"

/*
 * Les espaces pro, admin et les textes légaux se chargent à la demande.
 *
 * Un seul paquet de 492 Ko partait chez chaque visiteuse : l'agenda des
 * gérants, la modération des avis et le référencement, pour chercher un
 * coiffeur. Ces pages arrivent maintenant quand on y va, et pas avant.
 */
const ProDashboard = lazy(() => import("./pages/pro/ProDashboard"))
const ProSalon = lazy(() => import("./pages/pro/ProSalon"))
const MonPlanning = lazy(() => import("./pages/pro/MonPlanning"))
const AdminSalons = lazy(() => import("./pages/admin/AdminSalons"))
const MentionsLegales = lazy(() => import("./pages/legal/MentionsLegales"))
const Conditions = lazy(() => import("./pages/legal/Conditions"))
const Confidentialite = lazy(() => import("./pages/legal/Confidentialite"))

export default function App() {
  /* La soirée : posée à l'arrivée, puis vérifiée chaque minute — 20 h tombe
     pendant qu'une page est ouverte. */
  useEffect(() => {
    appliquerSoiree()
    const t = setInterval(appliquerSoiree, 60000)
    return () => clearInterval(t)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          {/* Rendu une fois pour toutes les routes : le logo et la navigation
              sont donc sur chaque page, jusqu'à celle d'erreur. */}
          <Header />
          <main className="flex-1 pb-16 md:pb-0">
            <BarriereErreur>
            <Suspense fallback={<Loader />}>
            <Routes>
              {/* La vitrine pour qui découvre, le tableau de bord pour qui revient. */}
              <Route path="/" element={<Accueil />} />
              <Route path="/recherche" element={<Results />} />
              <Route path="/salon/:id" element={<SalonDetails />} />
              <Route path="/salon/:id/reserver" element={<Reservation />} />
              <Route path="/compte" element={<Account />} />
              {/* Entrée des professionnels : une prise de contact, pas une inscription. */}
              <Route path="/professionnels" element={<Professionnels />} />
              {/* Accessible sans connexion : le lien signé fait office d'autorisation. */}
              <Route path="/annuler" element={<AnnulationParLien />} />
              <Route path="/pro" element={<RequireRole role="pro"><ProDashboard /></RequireRole>} />
              {/* Accessible à tout membre d'équipe, pas seulement aux propriétaires. */}
              <Route path="/mon-planning" element={<RequireRole role="pro"><MonPlanning /></RequireRole>} />
              <Route path="/pro/salon/:id" element={<RequireRole role="pro"><ProSalon /></RequireRole>} />
              <Route path="/admin" element={<RequireRole role="admin"><AdminSalons /></RequireRole>} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/conditions" element={<Conditions />} />
              <Route path="/confidentialite" element={<Confidentialite />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </BarriereErreur>
          </main>
          <BarreBasse />
          <footer className="border-t border-stone-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-stone-500">
              <span>© {new Date().getFullYear()} DarZin</span>
              <span className="flex gap-4">
                <Link to="/professionnels" className="hover:text-stone-800">
                  Vous êtes un salon ?
                </Link>
                <Link to="/mentions-legales" className="hover:text-stone-800">Mentions légales</Link>
                <Link to="/conditions" className="hover:text-stone-800">Conditions</Link>
                <Link to="/confidentialite" className="hover:text-stone-800">Données personnelles</Link>
              </span>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
