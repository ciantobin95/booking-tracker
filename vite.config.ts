import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed at https://<user>.github.io/booking-tracker/ — override BASE_PATH
// if the repo is ever renamed or moved to a custom domain.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/booking-tracker/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      workbox: {
        // Precache the app shell; booking data offline is handled separately
        // by Firestore's IndexedDB cache, so the SW must not intercept it.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'Booking Tracker',
        short_name: 'Bookings',
        description: 'Flights, stays and rentals in one calendar.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1a73e8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
