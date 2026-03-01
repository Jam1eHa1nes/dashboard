import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:         '#0A0C10',
        panel:      '#111318',
        'panel-alt':'#161B27',
        border:     '#1E2230',
        accent:     '#00E5FF',
        success:    '#00FF94',
        error:      '#FF4560',
        warning:    '#FFB800',
        text:       '#E2E8F0',
        muted:      '#64748B',
      },
      fontFamily: {
        body:    ['Inter',          'system-ui', 'sans-serif'],
        heading: ['Syne',           'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
