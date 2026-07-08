/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F6F1E8',
        surface: '#EBE3D6',
        primary: {
          DEFAULT: '#3A2A1E',
          hover: '#2E2117',
        },
        accent: {
          DEFAULT: '#B8674A',
          hover: '#A55A3F',
          muted: '#D4A08A',
        },
        'secondary-accent': {
          DEFAULT: '#718264',
          hover: '#5F7054',
          muted: '#A8B59E',
        },
        'text-primary': '#3A2A1E',
        'text-muted': '#7A6B5C',
        border: {
          DEFAULT: '#D9CEBF',
          strong: '#C4B5A2',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        body: ['Sora', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-lg': ['3rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'display-sm': ['1.75rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75' }],
        body: ['1rem', { lineHeight: '1.7' }],
        'body-sm': ['0.875rem', { lineHeight: '1.65' }],
        caption: ['0.75rem', { lineHeight: '1.55', letterSpacing: '0.015em' }],
      },
      boxShadow: {
        soft: '0 4px 24px -6px rgba(58, 42, 30, 0.1)',
        'soft-md': '0 8px 32px -8px rgba(58, 42, 30, 0.12)',
        'soft-inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      transitionDuration: {
        DEFAULT: '220ms',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.92)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        'gentle-breathe': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'soft-pulse': 'soft-pulse 1.8s ease-in-out infinite',
        'gentle-breathe': 'gentle-breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
