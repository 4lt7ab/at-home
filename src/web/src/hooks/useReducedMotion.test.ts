import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "./useReducedMotion";

let mediaChangeHandler: ((e: { matches: boolean }) => void) | null = null;
const mockAddEventListener = vi.fn(
  (_event: string, handler: (e: { matches: boolean }) => void) => {
    mediaChangeHandler = handler;
  },
);
const mockRemoveEventListener = vi.fn();

function setupMatchMedia(matches: boolean) {
  mediaChangeHandler = null;
  mockAddEventListener.mockClear();
  mockRemoveEventListener.mockClear();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: () => false,
    }),
  });
}

describe("useReducedMotion", () => {
  beforeEach(() => {
    setupMatchMedia(false);
  });

  it("returns false when prefers-reduced-motion is not set", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce is active", () => {
    setupMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("subscribes to matchMedia change events", () => {
    renderHook(() => useReducedMotion());
    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("updates when the media query changes", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mediaChangeHandler!({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it("removes listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
