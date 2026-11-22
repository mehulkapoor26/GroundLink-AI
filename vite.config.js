import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getLanHttpsOptions } from './vite-https.js';

export default defineConfig(async ({ command }) => ({
  root: 'frontend',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    https: command === 'serve' ? await getLanHttpsOptions() : undefined,
    proxy: { '/api': 'http://localhost:8000', '/socket.io': { target: 'http://localhost:8000', ws: true } }
  },
  build: { outDir: '../backend/dist', emptyOutDir: true }
}));
