import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8081", // ton Keycloak
  realm: "booking-realm",
  clientId: "booking-app", // ⚠️ doit matcher avec ton client Keycloak
});

export default keycloak;
