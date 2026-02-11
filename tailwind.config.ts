import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        festival: {
          orange: '#FF6B35',
          red: '#E63946',
          dark: '#0D1117',
          darker: '#010409',
          card: '#161B22',
          border: '#30363D',
          text: '#C9D1D9',
          muted: '#8B949E',
        },
      },
      fontFamily: {
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 107, 53, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 107, 53, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
