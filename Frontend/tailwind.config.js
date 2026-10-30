/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  theme: {
    colors: {
      // Include modern color palette
      slate: colors.slate,     // was blueGray
      gray: colors.gray,       // was coolGray
      neutral: colors.neutral, // was trueGray
      stone: colors.stone,     // was warmGray
      sky: colors.sky,         // was lightBlue

      // Standard colors
      black: colors.black,
      white: colors.white,
      red: colors.red,
      orange: colors.orange,
      amber: colors.amber,
      yellow: colors.yellow,
      lime: colors.lime,
      green: colors.green,
      emerald: colors.emerald,
      teal: colors.teal,
      cyan: colors.cyan,
      indigo: colors.indigo,
      violet: colors.violet,
      purple: colors.purple,
      fuchsia: colors.fuchsia,
      pink: colors.pink,
      rose: colors.rose,

      // For backwards compatibility
      blueGray: colors.slate,
      coolGray: colors.gray,
      trueGray: colors.neutral,
      warmGray: colors.stone,
      lightBlue: colors.sky,

      // Add full blue color palette from Tailwind
      blue: colors.blue,

      // Your custom colors
      'blue': {
        DEFAULT: '#365486',
        hover: 'rgb(19 37 73)',
      },
      'dark-blue': {
        DEFAULT: '#0F1035',
      }, 
      'light-blue': {
        DEFAULT: '#7FC7D9',
      },
      'sky-blue': { 
        DEFAULT: '#DCF2F1',
      },
    },
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    // line-clamp is now included by default in Tailwind CSS v3.3+
    require('@tailwindcss/aspect-ratio'),
  ],
}
