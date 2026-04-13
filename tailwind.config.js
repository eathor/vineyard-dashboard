/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vine: {
          50: '#F5F8F5',
          100: '#D5E8D5',
          600: '#2E4A2E',
          700: '#1E3A1E',
          800: '#0E2A0E',
        },
      },
    },
  },
  plugins: [],
};