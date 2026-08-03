/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand blue — matches logo's cobalt blue
        primary: {
          50:  '#EEF3FF',
          100: '#DCE7FF',
          200: '#BAD0FF',
          300: '#8AADFF',
          400: '#558AFF',
          500: '#3370E8',
          600: '#2456D8',  // main brand blue
          700: '#1B44B8',
          800: '#153696',
          900: '#0F2778',
        },
        // Brand orange — matches logo's gift-ribbon orange
        accent: {
          50:  '#FFF5EC',
          100: '#FFE8CC',
          200: '#FFD099',
          300: '#FFB066',
          400: '#FF8F33',
          500: '#F47920',  // main accent orange
          600: '#D96212',
          700: '#B54D0C',
          800: '#923B08',
          900: '#722D06',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand':   '0 4px 24px rgba(36, 86, 216, 0.18)',
        'brand-lg':'0 8px 40px rgba(36, 86, 216, 0.22)',
        'orange':  '0 4px 20px rgba(244, 121, 32, 0.25)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #EEF3FF 0%, #FFEEE0 100%)',
        'blue-gradient': 'linear-gradient(135deg, #2456D8 0%, #1B44B8 100%)',
        'orange-gradient': 'linear-gradient(135deg, #F47920 0%, #D96212 100%)',
      },
    },
  },
  plugins: [],
};
