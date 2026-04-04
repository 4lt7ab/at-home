import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { themes } from "./theme";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function isolatedWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider isolated>
      {children}
    </ThemeProvider>
  );
}

function forcedWrapper(themeName: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider forcedTheme={themeName} isolated>
        {children}
      </ThemeProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.removeItem("home-theme");
  document.body.style.background = "";
  document.body.style.color = "";
  document.body.style.fontFamily = "";
  document.documentElement.removeAttribute("data-animated-theme");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">hello</div>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides theme object via useTheme()", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBeDefined();
    expect(result.current.theme.color.primary).toBeTruthy();
    expect(result.current.themeName).toBe("deepTeal");
    expect(typeof result.current.setTheme).toBe("function");
  });

  it("defaults to deepTeal when no localStorage value", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.themeName).toBe("deepTeal");
    expect(result.current.theme).toBe(themes.deepTeal);
  });

  it("setTheme changes the active theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.themeName).toBe("deepTeal");

    act(() => {
      result.current.setTheme("ember");
    });

    expect(result.current.themeName).toBe("ember");
    expect(result.current.theme).toBe(themes.ember);
  });

  it("persists theme to localStorage under key 'home-theme'", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("ember");
    });

    expect(localStorage.getItem("home-theme")).toBe("ember");
  });

  it("reads initial theme from localStorage", () => {
    localStorage.setItem("home-theme", "ember");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.themeName).toBe("ember");
    expect(result.current.theme).toBe(themes.ember);
  });

  it("falls back to deepTeal for unknown theme names", () => {
    localStorage.setItem("home-theme", "nonexistent");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.themeName).toBe("nonexistent");
    expect(result.current.theme).toBe(themes.deepTeal);
  });

  it("forcedTheme overrides localStorage", () => {
    localStorage.setItem("home-theme", "ember");
    const { result } = renderHook(() => useTheme(), {
      wrapper: forcedWrapper("deepTeal"),
    });
    expect(result.current.themeName).toBe("deepTeal");
  });

  it("applies body styles when not isolated", () => {
    renderHook(() => useTheme(), { wrapper });
    // jsdom may normalize hex to rgb, so check that the style was set (not empty)
    expect(document.body.style.background).toBeTruthy();
    expect(document.body.style.color).toBeTruthy();
    expect(document.body.style.fontFamily).toContain("Inter");
  });

  it("skips body mutations when isolated", () => {
    // Clear any styles from prior tests
    document.body.style.background = "";
    document.body.style.color = "";
    document.body.style.fontFamily = "";

    renderHook(() => useTheme(), { wrapper: isolatedWrapper });
    // isolated mode should not have set any body styles
    expect(document.body.style.fontFamily).toBe("");
  });
});

describe("useTheme", () => {
  it("throws if used outside ThemeProvider", () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow("useTheme must be used within a ThemeProvider");
    spy.mockRestore();
  });
});
