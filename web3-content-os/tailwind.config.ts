import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#080A09', soft: '#0D100F', card: '#111514', hover: '#161B19' },
        line: { DEFAULT: 'rgba(255,255,255,0.08)', strong: 'rgba(255,255,255,0.14)' },
        primary: { DEFAULT: '#43FFB0', dim: 'rgba(67,255,176,0.12)', text: '#0A0F0D' },
        fg: { DEFAULT: '#F5F7F6', muted: '#9AA3A0', dim: '#6B7471' },
        danger: '#FF6B6B',
        warn: '#FFC857'
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'PingFang SC', 'Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: { soft: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.35)' },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } }
      },
      animation: { 'fade-in': 'fade-in .25s ease-out', shimmer: 'shimmer 1.6s linear infinite' }
    }
  },
  plugins: []
}
export default config
