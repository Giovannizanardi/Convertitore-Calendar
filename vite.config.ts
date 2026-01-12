import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'; // Importa il modulo 'path'

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