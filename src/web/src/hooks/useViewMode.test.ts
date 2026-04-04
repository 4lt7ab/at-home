import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewMode } from "./useViewMode";

beforeEach(() => {
  localStorage.removeItem("viewMode");
});

describe("useViewMode", () => {
  it("defaults to 'list' when localStorage is empty", () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("list");
  });

  it("reads initial mode from localStorage key 'viewMode'", () => {
    localStorage.setItem("viewMode", "gallery");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("gallery");
  });

  it("returns 'list' for invalid localStorage values", () => {
    localStorage.setItem("viewMode", "invalid-value");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("list");
  });

  it("setViewMode persists to localStorage", () => {
    const { result } = renderHook(() => useViewMode());

    act(() => {
      result.current.setViewMode("gallery");
    });

    expect(result.current.viewMode).toBe("gallery");
    expect(localStorage.getItem("viewMode")).toBe("gallery");
  });

  it("toggleViewMode flips list -> gallery", () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("list");

    act(() => {
      result.current.toggleViewMode();
    });

    expect(result.current.viewMode).toBe("gallery");
  });

  it("toggleViewMode flips gallery -> list", () => {
    localStorage.setItem("viewMode", "gallery");
    const { result } = renderHook(() => useViewMode());
    expect(result.current.viewMode).toBe("gallery");

    act(() => {
      result.current.toggleViewMode();
    });

    expect(result.current.viewMode).toBe("list");
  });

  it("toggleViewMode persists the new value to localStorage", () => {
    const { result } = renderHook(() => useViewMode());

    act(() => {
      result.current.toggleViewMode();
    });

    expect(localStorage.getItem("viewMode")).toBe("gallery");

    act(() => {
      result.current.toggleViewMode();
    });

    expect(localStorage.getItem("viewMode")).toBe("list");
  });
});
