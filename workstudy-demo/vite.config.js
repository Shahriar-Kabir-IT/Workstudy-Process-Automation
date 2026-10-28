import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // dev server proxies /api -> the local API so the app can call same-origin /api everywhere
  server: { port: 5190, host: true, proxy: { '/api': 'http://localhost:4000' } }
})
