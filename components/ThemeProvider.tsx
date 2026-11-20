'use client';

// components/ThemeProvider.tsx
// Light/dark theme for the whole site.
//
// FOUC (flash of unthemed content)
//   The toggle writes `data-theme="light|dark"` on <html>. Without a blocking
//   script in <head>, the server-rendered HTML paints in the default light
//   theme first and then snaps to dark on hydration — a white flash on every
//   navigation for every dark-mode visitor. app/layout.tsx therefore injects an
//   inline <script> that applies the stored theme BEFORE first paint; this
//   provider only syncs React state to whatever that script already decided.
//
// WHY DEFAULT IS LIGHT, NOT "follow the OS"
//   Belwee is a clinic: most visitors are on phones in daylight, and the brand
//   surface is light glass. Respecting `prefers-color-scheme` would show a dark
//   site to someone whose phone is in dark mode but who came to read about
//   their dog. The choice is explicit and reversible, and it is remembered.
//
// SCOPE — navbar and footer are deliberately EXCLUDED
//   Both are brand surfaces that read as "chrome" rather than content: the
//   footer is a navy panel and the navbar is dark glass, both of which have
//   tuned contrast ratios against photography. Recolouring them per-theme would
//   mean re-tuning that contrast in two modes for no benefit, so they are
//   pinned to their existing appearance.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'belwee-theme';
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The blocking script injected into <head>.
 *
 * Exported rather than inlined at the call site so the string is defined once
 * and stays in sync with the constants above. Must be a self-contained
 * expression: it runs before any module loads.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('${THEME_ATTRIBUTE}', theme);
    var root = document.documentElement.style;
    root.setProperty('--bg-color', theme === 'dark' ? '#1a1a2e' : '#fdf6e3');
    root.setProperty('--text-color', theme === 'dark' ? '#e0e0e0' : '#5c4a3d');
    root.setProperty('--toggle-bg', theme === 'dark' ? '#2d1b4e' : '#87ceeb');
  } catch (e) {
    document.documentElement.setAttribute('${THEME_ATTRIBUTE}', 'light');
  }
})();
`.trim();

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
  /** False until the client has read what the head script applied. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const current = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (current === 'dark' || current === 'light') return current;
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Mirror the mode onto the CSS custom properties the toggle itself reads. */
function paintTokens(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.style.setProperty('--bg-color', theme === 'dark' ? '#1a1a2e' : '#fdf6e3');
  root.style.setProperty('--text-color', theme === 'dark' ? '#e0e0e0' : '#5c4a3d');
  root.style.setProperty('--toggle-bg', theme === 'dark' ? '#2d1b4e' : '#87ceeb');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start at 'light' so the server and the first client render AGREE. Reading
  // the real theme during render is what produces a hydration mismatch here.
  const [theme, setThemeState] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const actual = readStoredTheme();
    setThemeState(actual);
    // The head script already set the attribute; re-assert the CSS custom
    // properties too, because a user who has the site open in a second tab may
    // have switched theme there.
    paintTokens(actual);
    setReady(true);
  }, []);

  // Keep other tabs in step. Without this, the toggle in tab A leaves tab B
  // showing the old theme until a reload.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = event.newValue === 'dark' ? 'dark' : 'light';
      setThemeState(next);
      paintTokens(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    paintTokens(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the theme still applies for this page view */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, ready }),
    [theme, setTheme, toggleTheme, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải được dùng bên trong <ThemeProvider>');
  return ctx;
}