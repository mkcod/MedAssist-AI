/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef7ff',
          100: '#d9eeff',
          200: '#bce0ff',
          300: '#8eceff',
          400: '#59b3ff',
          500: '#3395f5',
          600: '#1c77eb',
          700: '#1560d0',
          800: '#174fa9',
          900: '#184485',
          950: '#132b52',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'typing': 'typing 1.2s steps(3) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        typing: {
          '0%,100%': { content: "'•'" },
          '33%': { content: "'••'" },
          '66%': { content: "'•••'" },
        },
      },
    },
  },
  plugins: [],
}
