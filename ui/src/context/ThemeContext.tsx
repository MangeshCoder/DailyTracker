import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 15: Theme Context (dark / light toggle)
// ═══════════════════════════════════════════════════════════════════════════════
interface ThemeContextType { theme: 'dark' | 'light'; toggleTheme: () => void; isDark: boolean; }
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

  const toggleTheme = useCallback(() =>
    setTheme(prev => prev === 'dark' ? 'light' : 'dark'), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);