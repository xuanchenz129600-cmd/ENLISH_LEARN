import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TS error about cwd() not existing on Process interface
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    define: {
      // Vital: Map the VITE_API_KEY from env/secrets to process.env.API_KEY for the SDK to work
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'LinguaFlow Learning',
          short_name: 'LinguaFlow',
          description: 'Immersive Language Learning with AI',
          theme_color: '#050505',
          background_color: '#050505',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    // IMPORTANT: This ensures assets are loaded correctly on GitHub Pages
    base: './',
    build: {
      outDir: 'dist',
    }
  }
})
