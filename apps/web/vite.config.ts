import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: false } },
  },
  preview: { port: 4173, proxy: { '/api': { target: 'http://localhost:4000' } } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'three';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('react-router')) return 'react';
          return undefined;
        },
      },
    },
  },
});
