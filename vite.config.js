import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getLanHttpsOptions, getLanIPv4 } from './vite-https.js';

export default defineConfig(async ({ command }) => ({
  root: 'frontend',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_LAN_IP': JSON.stringify(getLanIPv4())
  },
  server: {
    host: '0.0.0.0',
    https: command === 'serve' ? await getLanHttpsOptions() : undefined,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:8000', changeOrigin: true, ws: true }
    }
  },
  build: { outDir: '../backend/dist', emptyOutDir: true }
}));
