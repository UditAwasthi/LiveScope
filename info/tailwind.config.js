/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // LiveScope · premium steel theme
        bg: '#0F1114', // gunmetal
        surface: '#15181C',
        'surface-2': '#1C2026',
        ink: '#E3E6EA', // polished steel text
        'ink-2': '#9AA1A9', // brushed steel secondary
        muted: '#5F666E',
        rule: '#262B31',
        edge: 'rgba(255,255,255,0.08)', // bevel highlight
        accent: '#D97757',
        healthy: '#8FA66B',
        failure: '#D45A49',
      },
      fontFamily: {
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      maxWidth: { page: '1200px' },
      letterSpacing: { label: '0.08em' },
      boxShadow: {
        bevel: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.6)',
        'bevel-lg': 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.6), 0 24px 60px -30px rgba(0,0,0,0.9)',
        chrome: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.35), 0 10px 30px -12px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
};
