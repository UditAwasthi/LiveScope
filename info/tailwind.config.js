/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: { 400: '#ff6b4a' },
      },
    },
  },
  plugins: [],
};
