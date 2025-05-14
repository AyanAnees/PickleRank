/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0076A8', // Pantone 7690 C
          dark: '#005EB8',    // Pantone 7687 C
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        secondary: {
          DEFAULT: '#007A3E', // Pantone 7732 C
        },
        accent: {
          DEFAULT: '#FFC600', // Pantone 123 C
        },
        background: {
          DEFAULT: '#F4F5F0', // Pantone 11-0601 TCX
        }
      },
    },
  },
  plugins: [],
} 