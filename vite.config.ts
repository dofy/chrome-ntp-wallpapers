import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const SIDECAR = process.env.NTP_API ?? 'http://127.0.0.1:8791'

// Images and metadata both live behind the Python sidecar, so the wallpaper
// bytes never have to be copied into public/ or bundled into dist/. Both dev
// and preview need the same proxy table.
const proxy = {
  '/api': { target: SIDECAR, changeOrigin: true },
  '/images': { target: SIDECAR, changeOrigin: true },
  '/thumbs': { target: SIDECAR, changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5188, proxy },
  preview: { port: 5189, proxy },
})
