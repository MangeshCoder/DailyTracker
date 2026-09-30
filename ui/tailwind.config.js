/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
//  Designs — each person picks one in the account menu (saved in the browser):
//    montcrest (default) · navy "Dashdark" surfaces in Montcrest's logo colours
//    purple              · the Dashdark template's own purple + cyan
//    blue                · the original DailyTracker colours (Tailwind defaults, Inter)
//
//  The pages are written with Tailwind's slate / blue / indigo / violet / purple /
//  amber classes. Those scales read CSS variables (--c-blue-500 …), and each design
//  sets the variables on <html data-design="…"> — so one switch re-colours every
//  page, no reload. Change a colour here, not in the pages.
//
//  Roles of the scales:  slate = neutrals (950 page, 900 card, 800 border …)
//    blue = primary (buttons, links, active menu) · indigo = its gradient partner
//    violet = accent · purple = extra category colour · amber = warnings / pending
// ─────────────────────────────────────────────────────────────────────────────
import plugin from 'tailwindcss/plugin';
import tw from 'tailwindcss/colors';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (...hex) => Object.fromEntries(SHADES.map((s, i) => [s, hex[i]]));

// ── shared Dashdark scales ──
const navy = scale('#F6F7FD', '#ECEFFA', '#D9E1FA', '#BCC6EA', '#96A3D0', '#6B77A0', '#5B6893', '#343B4F', '#1E2A4A', '#0B1739', '#081028');
const cyan = scale('#ECFAFF', '#D3F3FF', '#A8E8FF', '#66D8FF', '#21C8FF', '#00B4F0', '#007AA8', '#00658C', '#065C7E', '#0A4C68', '#063247');
const deepViolet = scale('#F4EFFF', '#EADFFF', '#D5C1FF', '#B795FF', '#9A62FF', '#7F25FB', '#6C14E6', '#580DBE', '#470F99', '#3B107A', '#240552');

// ── Montcrest: amber primary (400 = logo amber; 600 dark enough for white text) + maroon ──
const montAmber = scale('#FFF8EB', '#FEEDCC', '#FCD999', '#F7BF5C', '#EE9E22', '#D0800C', '#B35F00', '#924B00', '#733B04', '#5C3007', '#341A02');
const maroon = scale('#FDF3F3', '#FBE4E4', '#F5C4C5', '#EC9A9C', '#E0666A', '#C23A3F', '#A8232A', '#961B1F', '#7A1619', '#641518', '#3A0809');
// warnings in yellow so they don't look like the amber buttons (600/700 darkened for text on white)
const warnYellow = scale('#FEFCE8', '#FEF9C3', '#FEF08A', '#FDE047', '#FACC15', '#EAB308', '#B88A04', '#946B06', '#854D0E', '#713F12', '#422006');

// ── Dashdark purple primary ──
const dashPurple = scale('#FBF3FF', '#F4E2FF', '#EAC6FF', '#DC98FF', '#CB3CFF', '#B32BEF', '#9A1BD6', '#7C14AF', '#5F108A', '#4A0E6B', '#2E0545');

const DESIGNS = {
  montcrest: { slate: navy, blue: montAmber, indigo: maroon, violet: cyan, purple: deepViolet, amber: warnYellow,
               font: '"Mona Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  purple:    { slate: navy, blue: dashPurple, indigo: deepViolet, violet: cyan, purple: deepViolet, amber: tw.amber,
               font: '"Mona Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  blue:      { slate: tw.slate, blue: tw.blue, indigo: tw.indigo, violet: tw.violet, purple: tw.purple, amber: tw.amber,
               font: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
};
const THEMED = ['slate', 'blue', 'indigo', 'violet', 'purple', 'amber'];

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`; };
const cssVars = (d) => ({
  '--font-sans': d.font,
  ...Object.fromEntries(THEMED.flatMap(name => SHADES.map(s => [`--c-${name}-${s}`, rgb(d[name][s])]))),
});
const fromVars = (name) => Object.fromEntries(SHADES.map(s => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(THEMED.map(n => [n, fromVars(n)])),
        gray: fromVars('slate'),
        brand: { maroon: '#961B1F', amber: '#EE9E22' },   // Montcrest logo colours
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(8,16,40,.06), 0 8px 24px -12px rgba(8,16,40,.18)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => addBase({
      ':root, [data-design="montcrest"]': cssVars(DESIGNS.montcrest),
      '[data-design="purple"]': cssVars(DESIGNS.purple),
      '[data-design="blue"]': cssVars(DESIGNS.blue),
    })),
  ],
}
