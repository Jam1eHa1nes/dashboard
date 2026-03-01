import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  // Proxy API calls to Vercel dev server during local development
  server: {
    proxy: {
      '/api': {
        target: 'https://dashboard.autonami.co.uk',
        changeOrigin: true,
      },
    },
  },
});
