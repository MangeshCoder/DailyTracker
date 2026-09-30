import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 15: Theme Context (dark / light toggle + colour design)
// ═══════════════════════════════════════════════════════════════════════════════
export type Design = 'montcrest' | 'purple' | 'blue';
/** The colour designs a person can pick (account menu) — defined in tailwind.config.js */
export const DESIGNS: { id: Design; label: string; hint: string; swatch: [string, string] }[] = [
  { id: 'montcrest', label: 'Montcrest',     hint: 'Amber & maroon, from the logo', swatch: ['#EE9E22', '#961B1F'] },
  { id: 'purple',    label: 'Dashdark Purple', hint: 'Purple & cyan on navy',       swatch: ['#CB3CFF', '#00C2FF'] },
  { id: 'blue',      label: 'Original Blue',   hint: 'The classic DailyTracker look', swatch: ['#2563EB', '#4F46E5'] },
];
const isDesign = (v: unknown): v is Design => DESIGNS.some(d => d.id === v);
const readDesign = (): Design => {
  try { const v = localStorage.getItem('design'); return isDesign(v) ? v : 'montcrest'; } catch { return 'montcrest'; }
};

interface ThemeContextType {
  theme: 'dark' | 'light'; toggleTheme: () => void; isDark: boolean;
  design: Design; setDesign: (d: Design) => void;
}
const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
  );

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // colour design: <html data-design="…"> switches the colour variables (index.html sets it before first paint too)
  const [design, setDesignState] = useState<Design>(readDesign);
  useEffect(() => {
    try { localStorage.setItem('design', design); } catch { /* private mode */ }
    document.documentElement.dataset.design = design;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-slate-950').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg.replace(/ /g, ',')})`);
  }, [design]);
  const setDesign = useCallback((d: Design) => setDesignState(d), []);

  const toggleTheme = useCallback(() =>
    setTheme(prev => prev === 'dark' ? 'light' : 'dark'), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark', design, setDesign }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);