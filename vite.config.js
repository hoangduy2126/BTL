import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Base public path when served in development or production.
  base: './',
  
  // Configure the development server
  server: {
    port: 3000,
    open: true, // Automatically open the app in the browser
    cors: true, // Enable CORS
  },

  build: {
    // Configure Rollup to build multiple HTML entry points
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        contact: resolve(__dirname, 'contact.html'),
        services: resolve(__dirname, 'services.html'),
        works: resolve(__dirname, 'works.html')
      }
    },
    // Chunk size warning limit (suppresses large chunk warnings for three.js etc if needed)
    chunkSizeWarningLimit: 1000,
  }
});
