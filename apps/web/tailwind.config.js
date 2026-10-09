/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Stitch (Material You blue)
        primary: {
          DEFAULT: '#0050cb',
          container: '#0066ff',
          fixed: '#dae1ff',
          'fixed-dim': '#b3c5ff',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#f8f7ff',
          fixed: '#001849',
          'fixed-variant': '#003fa4',
        },
        secondary: {
          DEFAULT: '#525f75',
          container: '#d6e3fe',
          fixed: '#d6e3fe',
          'fixed-dim': '#bac7e1',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#58657b',
          fixed: '#0e1c2f',
          'fixed-variant': '#3a475c',
        },
        tertiary: {
          DEFAULT: '#3d5b81',
          container: '#56749b',
          fixed: '#d3e4ff',
          'fixed-dim': '#aac9f4',
        },
        'on-tertiary': {
          DEFAULT: '#ffffff',
          container: '#f7f8ff',
          fixed: '#001c38',
          'fixed-variant': '#29486d',
        },
        surface: {
          DEFAULT: '#f8f9ff',
          dim: '#cbdbf5',
          bright: '#f8f9ff',
          variant: '#d3e4fe',
          container: {
            DEFAULT: '#e5eeff',
            low: '#eff4ff',
            lowest: '#ffffff',
            high: '#dce9ff',
            highest: '#d3e4fe',
          },
        },
        'on-surface': {
          DEFAULT: '#0b1c30',
          variant: '#424656',
        },
        background: '#f8f9ff',
        'on-background': '#0b1c30',
        outline: {
          DEFAULT: '#727687',
          variant: '#c2c6d8',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': {
          DEFAULT: '#ffffff',
          container: '#93000a',
        },
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',
        'inverse-primary': '#b3c5ff',
        'surface-tint': '#0054d6',
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