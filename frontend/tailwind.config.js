/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7C6FFF',
        'primary-dark': '#5B4ED4',
        'primary-light': '#A78BFA',
        success: '#00D68F',
        danger: '#FF4757',
        warning: '#FFB347',
        // Dark theme surfaces
        'dark-bg': '#0F0F1E',
        'dark-card': '#1A1A2E',
        'dark-surface': '#16213E',
        'dark-border': '#2A2A4A',
        'dark-elevated': '#222244',
        // Text on dark
        'text-primary': '#FFFFFF',
        'text-secondary': '#8B8BA7',
        'text-muted': '#5C5C7A',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'btn': '50px',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.2)',
        'card-lg': '0 8px 40px rgba(124,111,255,0.2)',
        'glow': '0 0 40px rgba(124,111,255,0.25)',
      },
    },
  },
  plugins: [],
}
