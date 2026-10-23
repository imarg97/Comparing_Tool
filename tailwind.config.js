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
        bc: {
          red: '#dc2626',
          'red-light': '#ef4444',
          'red-bg': 'rgba(220, 38, 38, 0.12)',
          'red-bg-light': '#fee2e2',
          blue: '#2563eb',
          'blue-light': '#3b82f6',
          'blue-bg': 'rgba(37, 99, 235, 0.12)',
          'blue-bg-light': '#dbeafe',
          gray: '#6b7280',
          dark: '#000000',
          darker: '#050505',
          panel: '#0a0a0a',
          card: '#111111',
          border: '#222222',
          hover: '#171717',
          active: '#262626',
        },
        diff: {
          added: '#22c55e',
          'added-bg': 'rgba(34, 197, 94, 0.12)',
          deleted: '#ef4444',
          'deleted-bg': 'rgba(239, 68, 68, 0.12)',
          modified: '#f59e0b',
          'modified-bg': 'rgba(245, 158, 11, 0.12)',
          leftOnly: '#3b82f6',
          rightOnly: '#a855f7',
          identical: '#71717a',
          error: '#f43f5e'
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
