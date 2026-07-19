import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard is an ordinary API client. Everything under /api is
// proxied to the Rails backend, so no CORS setup is needed in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
