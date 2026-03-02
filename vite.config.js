import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths make the build portable across custom domains and GitHub Pages paths.
  base: './',
  plugins: [react()],
})
