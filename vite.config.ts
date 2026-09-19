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
        name: 'Neon Brawl',
        short_name: 'Neon Brawl',
        description: 'Draft neon creatures, build synergies, outlast every rival.',
        theme_color: '#080b14',
        background_color: '#080b14',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['games'],
        shortcuts: [
          { name: 'Play', url: '/run' },
          { name: 'How to play', url: '/how' },
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
