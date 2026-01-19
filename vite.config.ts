import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'; // Importa il modulo 'path'
import { fileURLToPath } from 'url'; // FIX: Importa fileURLToPath per gestire __dirname in ES modules

// FIX: Definisce __filename e __dirname per compatibilità con ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { // Aggiungi la configurazione di risoluzione degli alias
    alias: {
      "@": path.resolve(__dirname, "./"), // Mappa @ alla directory radice del progetto
    },
  },
  server: {
    host: true, // Rende il server accessibile sulla rete locale
  },
})