import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'Cairo', 'Tahoma', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: '#10b981',
        secondary: '#3b82f6',
        danger: '#ef4444',
        navy: {
          950: '#050816',
          900: '#0a1128',
          800: '#111b3a',
          700: '#1a2545',
        },
        cyan: {
          400: '#33ddff',
          500: '#00d4ff',
          600: '#00b8e0',
        },
      },
      boxShadow: {
        glow: '0 18px 60px rgba(0, 212, 255, 0.14)',
      },
      animation: {
        'fade-up': 'fadeUp 0.35s ease-out both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
    },
  },
  plugins: [],
}
export default config
