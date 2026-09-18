import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Neon Flap',
        short_name: 'Neon Flap',
        description: 'Tap to fly through a neon skyline. New course every day.',
        theme_color: '#080b14',
        background_color: '#080b14',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['games'],
        shortcuts: [
          { name: 'Play', url: '/play' },
          { name: 'Leaderboard', url: '/leaderboard' },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Phaser + Firebase in one chunk can exceed workbox's 2 MB precache default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2500,
  },
});
