import { defineConfig } from 'vite';

// base './' => le build statique fonctionne tel quel sur GitHub Pages / Netlify / itch.io
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
} as any);
