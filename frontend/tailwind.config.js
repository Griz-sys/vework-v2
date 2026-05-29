/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Outfit', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: 'none',
        'card-md': 'none',
      },
      letterSpacing: {
        tighter: '-0.02em',
      },
    },
  },
  plugins: [],
}
