/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta oscura estilo Linear/Stripe
        surface: {
          950: '#05060a',
          900: '#0b0f1a',
          800: '#121729',
          700: '#1a2138',
        },
        neon: {
          cyan: '#22d3ee',
          violet: '#8b5cf6',
          fuchsia: '#d946ef',
          rose: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(34,211,238,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(139,92,246,0.5)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
