/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Tailwind CSS v4, requis par HeroUI v3.
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En dev, le Front et l'API partagent la même origine : pas de CORS, cookie de session simple.
    // /uploads : images des événements (US08), servies par l'API hors du préfixe /api.
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
      '/uploads': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
