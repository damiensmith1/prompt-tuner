module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-sunk': 'var(--paper-sunk)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        rule: 'var(--rule)',
        pencil: 'var(--pencil)',
        'pencil-wash': 'var(--pencil-wash)',
        mark: 'var(--mark)',
      },
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        // A modular scale at roughly 1.25, set once so nothing is eyeballed.
        micro: ['0.75rem', { lineHeight: '1.4' }],
        small: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['0.9375rem', { lineHeight: '1.55' }],
        draft: ['1.25rem', { lineHeight: '1.6' }],
        title: ['1.75rem', { lineHeight: '1.2' }],
        display: ['2.75rem', { lineHeight: '1.08' }],
      },
      maxWidth: {
        measure: '34rem',
      },
      borderRadius: {
        sheet: '2px',
      },
    },
  },
  plugins: [],
};
