import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { Toaster } from 'sonner';
import { BrandProvider } from './components/ui/BrandProvider';
import { AuthProvider } from './context/AuthContext';
import { initializeContrastMode } from './lib/theme/highContrast';
import { queryClient } from './lib/react-query';
import { performanceMonitor } from './lib/performance';
import './styles/global.css';

// Initialize high contrast mode
initializeContrastMode();

// Initialize performance monitoring
if (performanceMonitor) {
  console.log('[Performance] Monitoring initialized');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrandProvider>
          <AuthProvider>
            <>
              <App />
              <Toaster position="top-center" richColors closeButton />
            </>
          </AuthProvider>
        </BrandProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
