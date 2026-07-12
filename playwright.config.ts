import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke test. Requires the Firebase emulators to be running first:
 *   firebase emulators:start --only auth,firestore --project demo-booking
 * Then: npm run test:e2e
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5173/booking-tracker/',
  },
  webServer: {
    command: 'VITE_EMULATORS=1 npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/booking-tracker/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
