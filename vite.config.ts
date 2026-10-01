import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
})
