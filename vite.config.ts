import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Situs dilayani di https://cassieorcasey.github.io/cassandra-home/
export default defineConfig({
  base: '/cassandra-home/',
  plugins: [react()],
})
