/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px -16px rgba(15, 23, 42, 0.18)',
        card: '0 1px 3px rgba(15, 23, 42, 0.05), 0 14px 34px -20px rgba(15, 23, 42, 0.28)',
        lift: '0 2px 6px rgba(15, 23, 42, 0.06), 0 22px 48px -20px rgba(79, 70, 229, 0.35)',
        glow: '0 0 0 1px rgba(129, 140, 248, 0.14), 0 10px 34px -10px rgba(99, 102, 241, 0.5)',
        chip: '0 1px 2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.18s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
