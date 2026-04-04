import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";

// ---------------------------------------------------------------------------
// matchMedia mock with controllable event handler
// ---------------------------------------------------------------------------

let mediaChangeHandler: ((e: { matches: boolean }) => void) | null = null;
let mockMediaMatches = false;
const mockAddEventListener = vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
  mediaChangeHandler = handler;
});
const mockRemoveEventListener = vi.fn();

function setupMatchMedia(matches = false) {
  mockMediaMatches = matches;
  mediaChangeHandler = null;
  mockAddEventListener.mockClear();
  mockRemoveEventListener.mockClear();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: mockMediaMatches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: () => false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.removeItem("theme");
  document.documentElement.classList.remove("dark", "light");
  setupMatchMedia(false);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTheme", () => {
  it("defaults to 'auto' when localStorage is empty", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("auto");
  });

  it("reads initial mode from localStorage key 'theme'", () => {
    localStorage.setItem("theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("dark");
  });

  it("returns 'auto' for invalid localStorage values", () => {
    localStorage.setItem("theme", "neon");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("auto");
  });

  it("setMode('dark') persists 'dark' to localStorage", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("dark");
    });

    expect(localStorage.getItem("theme")).toBe("dark");
    expect(result.current.mode).toBe("dark");
  });

  it("setMode('dark') adds .dark class, removes .light class on documentElement", () => {
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("dark");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("setMode('light') adds .light class, removes .dark class", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("light");
    });

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setMode('auto') removes both .dark and .light classes", () => {
    document.documentElement.classList.add("dark", "light");
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode("auto");
    });

    // In auto mode with OS preferring light, both classes removed (then dark not added)
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("in auto mode, adds .dark class when OS prefers dark", () => {
    setupMatchMedia(true); // OS prefers dark
    const { result } = renderHook(() => useTheme());

    // The mount effect applies auto mode -> sees OS prefers dark -> adds .dark
    expect(result.current.mode).toBe("auto");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("in auto mode, listens to matchMedia change events", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe("auto");
    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("matchMedia listener adds .dark when OS switches to dark", () => {
    renderHook(() => useTheme());

    expect(mediaChangeHandler).not.toBeNull();

    act(() => {
      mediaChangeHandler!({ matches: true });
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("matchMedia listener removes .dark when OS switches to light", () => {
    setupMatchMedia(true);
    renderHook(() => useTheme());

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      mediaChangeHandler!({ matches: false });
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("cleans up matchMedia listener when mode changes from auto to light/dark", () => {
    const { result } = renderHook(() => useTheme());
    expect(mockAddEventListener).toHaveBeenCalled();

    act(() => {
      result.current.setMode("dark");
    });

    // After mode changes away from auto, the effect should have cleaned up
    expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
