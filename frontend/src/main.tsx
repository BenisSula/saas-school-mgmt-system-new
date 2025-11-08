import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrandProvider } from './components/ui/BrandProvider';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrandProvider>
      <App />
    </BrandProvider>
  </React.StrictMode>
);

