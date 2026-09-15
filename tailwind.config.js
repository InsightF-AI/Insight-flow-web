/** Tokens do design system InsightFlow — dois temas via variáveis CSS (ver src/index.css). */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-2)',
        muted: 'var(--surface-3)',
        'border-soft': 'var(--border)',
        'border-main': 'var(--border-strong)',
        fg: {
          0: 'var(--ink)',
          1: 'var(--ink-2)',
          2: 'var(--ink-3)',
          3: 'var(--ink-4)',
        },
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)' },
        brand: 'var(--amber)',
        up: 'var(--up)',
        down: 'var(--down)',
        warn: 'var(--warn)',
        purple: 'var(--violet)',
        tone: {
          'green-bg': 'var(--tone-green-bg)',
          'red-bg': 'var(--tone-red-bg)',
          'yellow-bg': 'var(--tone-yellow-bg)',
          'orange-bg': 'var(--tone-orange-bg)',
          'orange-fg': 'var(--tone-orange-fg)',
          'blue-bg': 'var(--tone-blue-bg)',
          'violet-bg': 'var(--tone-violet-bg)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { DEFAULT: '0.875rem', sm: '0.5rem', xl: '0.875rem', '2xl': '1.25rem' },
      boxShadow: {
        sm: 'var(--shadow-1)',
        DEFAULT: 'var(--shadow-2)',
        md: 'var(--shadow-2)',
        lg: 'var(--shadow-3)',
        glow: 'var(--glow-accent)',
      },
    },
  },
  plugins: [],
};
