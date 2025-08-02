/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noirBlue: '#1e293b',
        noirGold: '#d4af37',
        noirGray: '#334155',
      },
      fontFamily: {
        noir: ['"Cinzel Decorative"', 'serif'], // add a detective style font or import Google Fonts
      },
    },
  },
  plugins: [],
}
