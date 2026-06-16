/* eslint-disable react-refresh/only-export-components -- context module
   intentionally co-locates the provider, the useTheme hook, and small theme
   helpers/constants used at app bootstrap (main.tsx). */
// src/context/ThemeContext.tsx
//
// App-wide colorway. Two named themes — 'sakura' (pink, the default) and
// 'cosmic' (blue/indigo) — are expressed as CSS custom properties keyed off a
// `data-theme` attribute on <html> (see styles tokens in index.css). This
// context only owns the *selection*: which theme is active, how to change it,
// and persisting the choice. Components stay theme-agnostic and read the tokens.
//
// To avoid a flash of the wrong colorway, main.tsx sets `data-theme` from the
// same localStorage key synchronously before React mounts; this provider keeps
// it in sync afterward.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'sakura' | 'cosmic';

export const THEME_STORAGE_KEY = 'mirror:theme';
const DEFAULT_THEME: Theme = 'cosmic';

export function isTheme(v: unknown): v is Theme {
  return v === 'sakura' || v === 'cosmic';
}

/** Read the persisted theme, falling back to the default. Safe on SSR. */
export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(saved)) return saved;
  } catch {
    /* localStorage blocked (private mode / cookies off) — use default */
  }
  return DEFAULT_THEME;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* persistence is best-effort */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((p) => (p === 'sakura' ? 'cosmic' : 'sakura')),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}