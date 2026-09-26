import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': src/main.tsx decides when to swap in a new build, so
      // it never reloads under a thumb mid-puzzle.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'a game',
        short_name: 'a game',
        description: 'Small logic puzzles for between chapters. One thumb, no sound, stop anytime.',
        // The page background, which is also the icon's tile.
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['games'],
        shortcuts: [
          { name: 'Play', url: '/play' },
          { name: 'Daily puzzle', url: '/daily' },
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
        // The bundled Inter too, so text looks the same offline.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // The new worker waits until src/main.tsx says it is safe to swap in.
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  build: {
    // Firebase alone is most of the one chunk; splitting it would only add round trips.
    chunkSizeWarningLimit: 1000,
  },
});
