/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get backend port from environment variable, default to 3001
const BACKEND_PORT = process.env.VITE_BACKEND_PORT
  ? Number(process.env.VITE_BACKEND_PORT)
  : process.env.PORT
    ? Number(process.env.PORT)
    : 3001;

// Validate port is a valid number
const isValidPort = (port: number): boolean => {
  return Number.isInteger(port) && port > 0 && port < 65536;
};

if (!isValidPort(BACKEND_PORT)) {
  console.warn(
    `[Vite] Invalid backend port: ${BACKEND_PORT}. Using default: 3001`
  );
}

const backendPort = isValidPort(BACKEND_PORT) ? BACKEND_PORT : 3001;

// Determine backend hostname:
// - In Docker: use service name 'backend' (resolvable via Docker network)
// - Local dev: use '127.0.0.1' (localhost)
// Check if running in Docker by looking for DOCKER environment or service name resolution
const isDocker = process.env.DOCKER === 'true' || process.env.COMPOSE_PROJECT_NAME;
const backendHost = isDocker ? 'backend' : '127.0.0.1';
const backendUrl = `http://${backendHost}:${backendPort}`;

if (process.env.NODE_ENV === 'development') {
  console.log(`[Vite] Proxy configured: /api -> ${backendUrl} (Docker: ${isDocker})`);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // Proxy API calls during dev to avoid CORS/DNS issues
      // Backend port is configurable via VITE_BACKEND_PORT or PORT env var
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('[Vite Proxy] Error:', err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'text/plain'
              });
              res.end(
                `Proxy error: Unable to connect to backend at ${backendUrl}. ` +
                  `Please ensure the backend server is running on port ${backendPort}.`
              );
            }
          });
        }
      },
      // Proxy WebSocket during dev if enabled on backend
      '/ws': {
        target: backendUrl,
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

