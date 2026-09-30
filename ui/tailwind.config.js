/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
//  Look & feel: "Dashdark" admin theme (deep navy surfaces, Mona Sans) in
//  Montcrest Software's colours (amber + maroon, from the logo). The app's pages
//  are written with Tailwind's slate / blue / indigo / … classes, so re-tuning those scales
//  here restyles every page at once — change a colour here, not in the pages.
//    slate  → navy-tinted neutrals (950 page, 900 card, 800 border/input …)
//    blue   → Montcrest amber  (400 = logo amber #EE9E22; 600 = button shade,
//             dark enough for white text)
//    indigo → Montcrest maroon (700 = logo maroon #961B1F; gradient partner)
//    violet → accent cyan      (#00C2FF)
//    purple → deep violet      (#7F25FB)
//    amber  → yellow: warnings / "pending" stay distinct from the amber buttons
// ─────────────────────────────────────────────────────────────────────────────
const slate = {
  50: '#F6F7FD', 100: '#ECEFFA', 200: '#D9E1FA', 300: '#BCC6EA', 400: '#96A3D0',
  500: '#6B77A0', 600: '#5B6893', 700: '#343B4F', 800: '#1E2A4A', 900: '#0B1739', 950: '#081028',
};
const primary = {
  50: '#FFF8EB', 100: '#FEEDCC', 200: '#FCD999', 300: '#F7BF5C', 400: '#EE9E22',
  500: '#D0800C', 600: '#B35F00', 700: '#924B00', 800: '#733B04', 900: '#5C3007', 950: '#341A02',
};
const maroon = {
  50: '#FDF3F3', 100: '#FBE4E4', 200: '#F5C4C5', 300: '#EC9A9C', 400: '#E0666A',
  500: '#C23A3F', 600: '#A8232A', 700: '#961B1F', 800: '#7A1619', 900: '#641518', 950: '#3A0809',
};
const warn = {   // Tailwind's yellow, 600/700 darkened a touch for text on white
  50: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047', 400: '#FACC15',
  500: '#EAB308', 600: '#B88A04', 700: '#946B06', 800: '#854D0E', 900: '#713F12', 950: '#422006',
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
        purple: deepViolet, indigo: maroon,
        amber: warn,
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
