import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'a game',
        short_name: 'a game',
        description: 'Draft creatures, build a team, outlast every rival.',
        theme_color: '#080b14',
        background_color: '#080b14',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['games'],
        shortcuts: [
          { name: 'Play', url: '/run' },
          { name: 'How to play', url: '/how' },
          { name: 'Rankings', url: '/ranks' },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // Its own file: a maskable icon needs the mark inside the safe circle, so it is
          // drawn smaller and edge to edge rather than reusing the rounded tile.
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
