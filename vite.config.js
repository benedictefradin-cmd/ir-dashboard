import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Replace 'ir-dashboard' with your actual repo name
  base: process.env.NODE_ENV === 'production' ? '/ir-dashboard/' : '/',
  build: {
    outDir: 'dist',
  },
})
