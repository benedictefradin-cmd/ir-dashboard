import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitePreview from './vite-plugin-site-preview.js'

export default defineConfig({
  plugins: [react(), sitePreview()],
  // Replace 'ir-dashboard' with your actual repo name
  base: process.env.NODE_ENV === 'production' ? '/ir-dashboard/' : '/',
  build: {
    outDir: 'dist',
  },
})
