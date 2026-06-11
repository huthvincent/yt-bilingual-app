/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // SF on Apple platforms, PingFang for Chinese, graceful fallbacks elsewhere.
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"',
          '"Helvetica Neue"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"',
          'Inter', 'system-ui', 'sans-serif',
        ],
      },
      colors: {
        // Single interactive accent across the product (iOS dark-mode blue).
        // Violet stays reserved for AI vocabulary highlights only.
        brand: {
          DEFAULT: '#0A84FF',
          300: '#66B0FF',
          400: '#409CFF',
          500: '#0A84FF',
          600: '#0774E8',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          dark: 'rgba(0, 0, 0, 0.2)',
          border: 'rgba(255, 255, 255, 0.05)',
        }
      },
      transitionTimingFunction: {
        // Apple-feel deceleration curve for micro-interactions
        apple: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      boxShadow: {
        // Layered, soft elevation shadows
        'elev-1': '0 1px 1px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.25)',
        'elev-2': '0 1px 1px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35)',
        'elev-3': '0 1px 2px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
