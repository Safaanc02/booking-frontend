# Site compilé, servi par Caddy, qui sert aussi de point d'entrée unique.
#
# Les adresses de l'API et de Keycloak sont relatives : Vite les inscrit dans
# le JavaScript à la compilation, et les valeurs par défaut ci-dessous
# supposent le routage du Caddyfile. Aucune variable à définir au déploiement,
# et rien à recompiler en changeant de domaine.

# ---- Compilation ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /chantier

COPY package*.json ./
RUN npm ci

COPY . .
# Chaîne vide et non « / » : axios concatène, et « / » + « /api » donnerait
# « //api », que le navigateur lit comme une adresse absolue sans protocole.
ENV VITE_API_URL="" \
    VITE_KEYCLOAK_URL="/auth" \
    VITE_KEYCLOAK_REALM="booking-realm" \
    VITE_KEYCLOAK_CLIENT_ID="booking-app"
RUN npm run build

# ---- Service -------------------------------------------------------
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /chantier/dist /srv
EXPOSE 80
