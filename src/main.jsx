import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: "http://localhost:8081/",
  realm: "booking-realm",
  clientId: "booking-app"
})

keycloak.init({ onLoad: 'login-required' }).then(authenticated => {
  if (authenticated) {
    console.log("✅ Authenticated", keycloak.token)
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App keycloak={keycloak} />
      </React.StrictMode>,
    )
  } else {
    console.warn("❌ Auth failed")
    keycloak.login()
  }
})
