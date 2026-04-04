import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "theme";

function getStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  return "auto";
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else if (mode === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    // auto: remove both explicit classes, let @media query handle it
    root.classList.remove("dark", "light");
    // But we also need to set .dark if OS prefers dark, because
    // inline styles using var() need the class for the :root.dark selector
    // Actually, the @media query in CSS handles :root:not(.light) already.
    // However, we still add/remove .dark for auto mode based on OS preference
    // so that the explicit :root.dark selector also works.
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    }
  }
}

export function useTheme(): { mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
    applyMode(m);
  }, []);

  // Apply on mount
  useEffect(() => {
    applyMode(mode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for OS preference changes when in auto mode
  useEffect(() => {
    if (mode !== "auto") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange(e: MediaQueryListEvent) {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [mode]);

  return { mode, setMode };
}
