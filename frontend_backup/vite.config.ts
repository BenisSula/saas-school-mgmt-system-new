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
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Error:', err.message);
            console.error('[Vite Proxy] Request:', req.method, req.url);
            // Try to send error response if possible
            try {
              if (res && 'writeHead' in res && typeof res.writeHead === 'function' && 'headersSent' in res && !res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'Proxy error',
                    message: 'Backend server may not be running on port 3001',
                    details: err.message
                  })
                );
              }
            } catch (responseError) {
              console.error('[Vite Proxy] Failed to send error response:', responseError);
            }
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[Vite Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
          });
        },
        timeout: 10000, // 10 second timeout
        ws: false // Disable WebSocket for this proxy
      },
      // Proxy WebSocket during dev if enabled on backend
      '/ws': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite Proxy WS] Error:', err.message);
          });
        }
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

