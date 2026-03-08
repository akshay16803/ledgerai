import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths make the build portable across custom domains and GitHub Pages paths.
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      '.preview.emergentagent.com',
      '.preview.emergentcf.cloud',
      '.cluster-8.preview.emergentcf.cloud',
      'localhost',
    ],
  },
})
