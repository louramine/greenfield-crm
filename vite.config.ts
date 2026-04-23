import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // esbuild transpile seulement, pas de vérification de types
    // les erreurs TypeScript ne bloquent pas le build Netlify
  },
});