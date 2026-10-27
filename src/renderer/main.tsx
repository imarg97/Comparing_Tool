import React from 'react';
import ReactDOM from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import App from './App.js';
import './index.css';
import { createBrowserFallbackAPI } from './utils/browser-api.js';

// Configure Monaco Editor to use the locally bundled monaco-editor npm package
// Prevents dynamic script fetching from third-party CDNs (https://cdn.jsdelivr.net)
loader.config({ monaco });

// If running in browser (e.g. hosted on Vercel), provide zero-telemetry client-side fallback
if (typeof window !== 'undefined' && !window.diffxAPI) {
  window.diffxAPI = createBrowserFallbackAPI();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
