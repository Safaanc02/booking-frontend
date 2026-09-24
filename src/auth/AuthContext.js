import { createContext } from "react"

/**
 * Valeur par défaut non nulle, volontairement.
 *
 * L'ancien createContext() sans argument renvoyait undefined, et App.jsx
 * faisait `const { authenticated } = useContext(AuthContext)` — un
 * destructuring de undefined qui plantait l'application au montage dès lors
 * que le provider n'était pas au-dessus. Un défaut cohérent rend le crash
 * impossible.
 */
export const AuthContext = createContext({
  ready: false,
  authenticated: false,
  user: null,
  roles: [],
  hasRole: () => false,
  login: () => {},
  logout: () => {},
  register: () => {},
})
