import { defineConfig } from 'vite';
import { resolve } from 'path'; // Import 'resolve' from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        // Add any other HTML files here
        // example: about: resolve(__dirname, 'about.html'),
      },
    },
  },
});