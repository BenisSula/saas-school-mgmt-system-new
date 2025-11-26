/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    // Enable code splitting for faster builds and smaller bundles
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - split by library type
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // React Query
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            // UI libraries
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('sonner')) {
              return 'ui-vendor';
            }
            // Utilities
            if (id.includes('zod') || id.includes('zustand') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor';
            }
            // Other node_modules
            return 'vendor';
          }
          // Route-based code splitting for admin pages
          if (id.includes('/pages/admin/')) {
            return 'admin-pages';
          }
          if (id.includes('/pages/superuser/')) {
            return 'superuser-pages';
          }
          if (id.includes('/pages/teacher/')) {
            return 'teacher-pages';
          }
          if (id.includes('/pages/student/')) {
            return 'student-pages';
          }
          if (id.includes('/pages/hod/')) {
            return 'hod-pages';
          }
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 500, // Reduced from 1000 to catch more issues
    // Enable source maps for better debugging
    sourcemap: true,
    // Minify for production
    minify: 'esbuild',
    // Enable tree-shaking
    treeshake: true,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Enable error overlay in development
    hmr: {
      overlay: true
    },
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

