/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        steam: {
          bg:      '#1b2838',
          panel:   '#2a475e',
          card:    '#16202d',
          accent:  '#66c0f4',
          hover:   '#1a9fff',
          text:    '#c7d5e0',
          muted:   '#8f98a0',
          border:  '#4c6b8a',
        },
      },
      fontFamily: {
        sans: ['"Motiva Sans"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
