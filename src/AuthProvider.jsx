import React, { useState, useEffect } from "react";
import keycloak from "./keycloak";
import { AuthContext } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    keycloak.init({ onLoad: "login-required" }).then((auth) => {
      setAuthenticated(auth);
      setToken(keycloak.token);

      // 🔄 Refresh auto du token
      setInterval(() => {
        keycloak.updateToken(70).then((refreshed) => {
          if (refreshed) setToken(keycloak.token);
        });
      }, 6000);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, token }}>
      {children}
    </AuthContext.Provider>
  );
}
