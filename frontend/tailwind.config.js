// frontend/tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgLight: '#f8fafc',
        cardLight: '#ffffff',
        borderLight: '#e2e8f0',
        textPrimary: '#1e293b',
        textSecondary: '#64748b',
        textMuted: '#94a3b8',
        accentBlue: '#0066ff',
        accentBlueHover: '#0052cc',
        accentBlueLight: '#eff6ff',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '4px',
      }
    },
  },
  plugins: [],
}
