/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens compartidos de la interfaz en tema oscuro.
        primary: {
          DEFAULT: '#93c5fd',
          container: '#60a5fa',
          fixed: '#dae1ff',
          'fixed-dim': '#b3c5ff',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#071827',
          fixed: '#001849',
          'fixed-variant': '#003fa4',
        },
        secondary: {
          DEFAULT: '#b1bdce',
          container: '#293648',
          fixed: '#d6e3fe',
          'fixed-dim': '#bac7e1',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#dce6f2',
          fixed: '#0e1c2f',
          'fixed-variant': '#3a475c',
        },
        tertiary: {
          DEFAULT: '#adc8ef',
          container: '#344b68',
          fixed: '#d3e4ff',
          'fixed-dim': '#aac9f4',
        },
        'on-tertiary': {
          DEFAULT: '#ffffff',
          container: '#e4efff',
          fixed: '#001c38',
          'fixed-variant': '#29486d',
        },
        surface: {
          DEFAULT: '#111720',
          dim: '#090d13',
          bright: '#202936',
          variant: '#293443',
          container: {
            DEFAULT: '#1b2430',
            low: '#171f2a',
            lowest: '#141b24',
            high: '#222d3a',
            highest: '#2a3543',
          },
        },
        'on-surface': {
          DEFAULT: '#edf2f8',
          variant: '#bac4d1',
        },
        background: '#111720',
        'on-background': '#edf2f8',
        outline: {
          DEFAULT: '#a0adbd',
          variant: '#354252',
        },
        error: {
          DEFAULT: '#ff8b82',
          container: '#482624',
        },
        'on-error': {
          DEFAULT: '#2a0d0b',
          container: '#ffd9d5',
        },
        'inverse-surface': '#e7edf5',
        'inverse-on-surface': '#202936',
        'inverse-primary': '#b3c5ff',
        'surface-tint': '#93c5fd',
        emerald: {
          50: '#183427',
          600: '#4ade80',
          700: '#86efac',
        },
        red: {
          50: '#3b2326',
          600: '#f87171',
          700: '#fca5a5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
};