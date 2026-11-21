import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // keycloak-js et le routeur dans leur propre fichier : ils changent
        // rarement, le navigateur les garde d'une version du site à l'autre.
        manualChunks: { auth: ["keycloak-js"], routeur: ["react-router-dom"] },
      },
    },
  },
})
