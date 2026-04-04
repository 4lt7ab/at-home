import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWindowWidth, SMALL_BREAKPOINT } from "./useWindowWidth";

describe("useWindowWidth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current window.innerWidth on mount", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1200);
  });

  it("updates when a resize event fires", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1024);

    act(() => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 500 });
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(500);
  });

  it("removes resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useWindowWidth());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("exports SMALL_BREAKPOINT as 768", () => {
    expect(SMALL_BREAKPOINT).toBe(768);
  });
});
