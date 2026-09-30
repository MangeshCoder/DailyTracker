/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
//  Look & feel: "Dashdark" admin theme (deep navy surfaces, purple primary,
//  cyan accent, Mona Sans). The app's pages are written with Tailwind's
//  slate / blue / violet / purple / indigo classes, so re-tuning those scales
//  here restyles every page at once — change a colour here, not in the pages.
//    slate  → navy-tinted neutrals (950 page, 900 card, 800 border/input …)
//    blue   → primary purple   (#CB3CFF)
//    violet → accent cyan      (#00C2FF)
//    purple / indigo → deep violet (#7F25FB)
// ─────────────────────────────────────────────────────────────────────────────
const slate = {
  50: '#F6F7FD', 100: '#ECEFFA', 200: '#D9E1FA', 300: '#BCC6EA', 400: '#96A3D0',
  500: '#6B77A0', 600: '#56638C', 700: '#343B4F', 800: '#1E2A4A', 900: '#0B1739', 950: '#081028',
};
const primary = {
  50: '#FBF3FF', 100: '#F4E2FF', 200: '#EAC6FF', 300: '#DC98FF', 400: '#CB3CFF',
  500: '#B32BEF', 600: '#9A1BD6', 700: '#7C14AF', 800: '#5F108A', 900: '#4A0E6B', 950: '#2E0545',
};
const cyan = {
  50: '#ECFAFF', 100: '#D3F3FF', 200: '#A8E8FF', 300: '#66D8FF', 400: '#21C8FF',
  500: '#00B4F0', 600: '#007AA8', 700: '#00658C', 800: '#065C7E', 900: '#0A4C68', 950: '#063247',
};
const deepViolet = {
  50: '#F4EFFF', 100: '#EADFFF', 200: '#D5C1FF', 300: '#B795FF', 400: '#9A62FF',
  500: '#7F25FB', 600: '#6C14E6', 700: '#580DBE', 800: '#470F99', 900: '#3B107A', 950: '#240552',
};

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate, gray: slate,
        blue: primary,
        violet: cyan,
        purple: deepViolet, indigo: deepViolet,
        brand: { maroon: '#961B1F', amber: '#EE9E22' },   // Montcrest logo colours
      },
      fontFamily: {
        sans: ['"Mona Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(8,16,40,.06), 0 8px 24px -12px rgba(8,16,40,.18)',
      },
    },
  },
  plugins: [],
}
