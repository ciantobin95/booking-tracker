import { defineConfig } from 'vite';

// Deployed at https://<user>.github.io/booking-tracker/ — override BASE_PATH
// if the repo is ever renamed or moved to a custom domain.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/booking-tracker/',
});
