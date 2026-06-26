import { useCallback, type ReactNode } from 'react';
import { createLocalStorageContext } from './createLocalStorageContext';

export type Theme = 'dark' | 'light';

const isTheme = (v: string): v is Theme => v === 'dark' || v === 'light';

const themeCtx = createLocalStorageContext<Theme>('bb-theme', 'theme', 'dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <themeCtx.Provider isValid={isTheme}>{children}</themeCtx.Provider>;
}

export function useTheme() {
  const [theme, setTheme] = themeCtx.useValue();
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  return { theme, setTheme, toggleTheme };
}
