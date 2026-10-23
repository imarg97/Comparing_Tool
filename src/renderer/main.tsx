import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import { createBrowserFallbackAPI } from './utils/browser-api.js';

// If running in browser (e.g. hosted on Vercel), provide zero-telemetry client-side fallback
if (typeof window !== 'undefined' && !window.diffxAPI) {
  window.diffxAPI = createBrowserFallbackAPI();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
