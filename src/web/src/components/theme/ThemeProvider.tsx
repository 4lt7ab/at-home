import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { themes } from "./theme";
import type { Theme } from "./theme";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  theme: Theme;
  themeName: string;
  setTheme: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "home-theme";
const DEFAULT_THEME = "deepTeal";

// ---------------------------------------------------------------------------
// ThemeProvider
// ---------------------------------------------------------------------------

export interface ThemeProviderProps {
  children: ReactNode;
  forcedTheme?: string;
  isolated?: boolean;
}

export function ThemeProvider({ children, forcedTheme, isolated }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<string>(() => {
    if (forcedTheme) return forcedTheme;
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
    }
    return DEFAULT_THEME;
  });

  const theme = themes[themeName] ?? themes[DEFAULT_THEME];

  const setTheme = useCallback((name: string) => {
    setThemeName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, name);
    }
  }, []);

  useEffect(() => {
    if (isolated) return;
    document.body.style.background = theme.color.surface;
    document.body.style.color = theme.color.text;
    document.body.style.fontFamily = theme.font.body;

    if (theme.glow.animated) {
      document.documentElement.setAttribute("data-animated-theme", themeName);
    } else {
      document.documentElement.removeAttribute("data-animated-theme");
    }
  }, [theme, themeName, isolated]);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// useTheme hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
