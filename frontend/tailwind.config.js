/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        card: 'var(--bg-card)',
        'card-subtle': 'var(--bg-card-subtle)',
        'border-subtle': 'var(--border-subtle)',
        'border-active': 'var(--border-active)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'accent-lime': 'var(--accent-lime)',
        'accent-lime-hover': 'var(--accent-lime-hover)',
        'on-lime': 'var(--text-on-lime)',
        'accent-emerald': 'var(--accent-emerald)',
        'accent-sky': 'var(--accent-sky)',
        'accent-amber': 'var(--accent-amber)',
        'accent-rose': 'var(--accent-rose)',
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        subtle: '0 2px 8px rgba(0, 0, 0, 0.4)',
        card: '0 8px 24px rgba(0, 0, 0, 0.45)',
        popover: '0 20px 48px rgba(0, 0, 0, 0.75)',
        lime: '0 0 24px rgba(194, 255, 0, 0.25)',
      },
    },
  },
  plugins: [],
};
