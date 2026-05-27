import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        kalshi: {
          bg: '#0f172a',
          panel: '#1e293b',
          border: '#334155',
          yes: '#22c55e',
          no: '#ef4444',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
