import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import AuthProvider from "./auth/AuthProvider"
import Header from "./components/Header"
import Home from "./pages/Home"
import Results from "./pages/Results"
import SalonDetails from "./pages/SalonDetails"
import Reservation from "./pages/Reservation"
import RequireRole from "./components/RequireRole"
import ProDashboard from "./pages/pro/ProDashboard"
import ProSalon from "./pages/pro/ProSalon"
import Account from "./pages/Account"
import Legal from "./pages/Legal"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recherche" element={<Results />} />
              <Route path="/salon/:id" element={<SalonDetails />} />
              <Route path="/salon/:id/reserver" element={<Reservation />} />
              <Route path="/compte" element={<Account />} />
              <Route path="/pro" element={<RequireRole role="pro"><ProDashboard /></RequireRole>} />
              <Route path="/pro/salon/:id" element={<RequireRole role="pro"><ProSalon /></RequireRole>} />
              <Route path="/mentions-legales" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="border-t border-stone-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-stone-500">
              <span>© {new Date().getFullYear()} Booking.ma</span>
              <Link to="/mentions-legales" className="hover:text-stone-800">Mentions légales</Link>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
