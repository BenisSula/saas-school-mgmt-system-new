/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // Proxy API calls during dev to avoid CORS/DNS issues
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // Proxy WebSocket during dev if enabled on backend
      '/ws': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  // @ts-expect-error Vitest config key; types provided by reference above
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  }
});

