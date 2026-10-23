/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        diff: {
          added: '#22c55e',
          'added-bg': 'rgba(34, 197, 94, 0.12)',
          'added-border': 'rgba(34, 197, 94, 0.35)',
          deleted: '#ef4444',
          'deleted-bg': 'rgba(239, 68, 68, 0.12)',
          'deleted-border': 'rgba(239, 68, 68, 0.35)',
          modified: '#f59e0b',
          'modified-bg': 'rgba(245, 158, 11, 0.12)',
          'modified-border': 'rgba(245, 158, 11, 0.35)',
          leftOnly: '#3b82f6',
          'leftOnly-bg': 'rgba(59, 130, 246, 0.12)',
          'leftOnly-border': 'rgba(59, 130, 246, 0.35)',
          rightOnly: '#a855f7',
          'rightOnly-bg': 'rgba(168, 85, 247, 0.12)',
          'rightOnly-border': 'rgba(168, 85, 247, 0.35)',
          identical: '#64748b',
          error: '#f43f5e'
        },
        panel: {
          bg: '#0f172a',
          sidebar: '#0b1120',
          header: '#1e293b',
          border: '#334155',
          hover: '#1e293b',
          active: '#334155',
          text: '#f1f5f9',
          muted: '#94a3b8'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
