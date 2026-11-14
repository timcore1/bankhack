/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#060913',
        panel: '#0d1324',
        neon: {
          cyan: '#22d3ee',
          emerald: '#10b981',
          violet: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 30px -8px rgba(34, 211, 238, 0.35)',
        emeraldGlow: '0 0 28px -8px rgba(16, 185, 129, 0.4)',
      },
    },
  },
  plugins: [],
};
