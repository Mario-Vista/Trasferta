/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0F',
        surface: '#18181B',
        border: '#27272A',
        text: '#F4F4F5',
        'text-muted': '#A1A1AA',
        accent: '#E4FF3A',
        danger: '#FF4D4D',
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Archivo"', 'sans-serif'],
        heading: ['"Archivo"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}
