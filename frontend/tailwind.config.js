/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#022b3a',
          50: '#e6f0f4',
          100: '#bfd4dd',
          200: '#8ab5c5',
          300: '#5496ad',
          400: '#2f7d9a',
          500: '#022b3a',
          600: '#012433',
          700: '#011d29',
          800: '#01161f',
          900: '#000e15',
        },
        teal: {
          DEFAULT: '#1f7a8c',
          50: '#e8f4f7',
          100: '#c5e3ea',
          200: '#9ed0db',
          300: '#77bdcc',
          400: '#4eaabb',
          500: '#1f7a8c',
          600: '#196879',
          700: '#135566',
          800: '#0d4253',
          900: '#073040',
        },
        sky: '#bfdbf7',
        frost: '#e1e5f2',
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'slide-in': 'slideIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scan: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
