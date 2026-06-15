import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0b6e4f',
          fg: '#ffffff',
          muted: '#e6f3ee',
        },
      },
    },
  },
  plugins: [],
};
export default config;
