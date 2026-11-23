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

# salon.html : la copie d'index.html servie sous /salon/*, avec une inclusion
# que Caddy résout à chaque requête — les balises de partage de la fiche
# demandée (voir le Caddyfile). Le <title> statique est retiré, le fragment
# apporte le sien ; la description statique aussi, pour la même raison.
#
# Faite ici et non dans le dépôt : les noms des ressources changent à chaque
# construction, et salon.html doit les porter exactement comme index.html.
RUN node -e '\
  const fs = require("fs"); \
  let h = fs.readFileSync("dist/index.html", "utf8"); \
  h = h.replace(/<title>[^<]*<\/title>\s*/, "").replace(/<meta name="description"[^>]*>\s*/, ""); \
  const inc = "{{ $id := index (splitList \"/\" .OriginalReq.URL.Path) 2 }}{{ httpInclude (printf \"/api/public/salons/%s/og\" $id) }}"; \
  h = h.replace("<head>", "<head>\n    " + inc); \
  fs.writeFileSync("dist/salon.html", h); \
  console.log("salon.html écrit"); \
'

# ---- Service -------------------------------------------------------
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /chantier/dist /srv
EXPOSE 80
