/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#EEF0F4',
        surface: '#FFFFFF',
        ink: '#171A21',
        muted: '#5B6474',
        line: '#D8DCE4',
        resolved: '#0F7B5A',
        escalated: '#B4690E',
        blocked: '#B42318',
        acting: '#1B4DB1',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
    },
  },
  plugins: [],
};
