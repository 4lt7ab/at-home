import { useState, useCallback } from "react";

export type ViewMode = "list" | "gallery";

const STORAGE_KEY = "viewMode";

function readStored(): ViewMode {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "gallery") return "gallery";
  } catch {
    // localStorage unavailable
  }
  return "list";
}

export function useViewMode() {
  const [viewMode, setViewModeRaw] = useState<ViewMode>(readStored);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeRaw((prev) => {
      const next = prev === "list" ? "gallery" : "list";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return { viewMode, setViewMode, toggleViewMode };
}
