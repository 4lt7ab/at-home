import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useHashRoute } from "./useHashRoute";

beforeEach(() => {
  window.location.hash = "";
});

describe("useHashRoute", () => {
  it("returns '/' when hash is empty", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.path).toBe("/");
  });

  it("returns '/' when hash is just '#'", () => {
    window.location.hash = "#";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.path).toBe("/");
  });

  it("returns path from window.location.hash (strips # prefix)", () => {
    window.location.hash = "#/tasks";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.path).toBe("/tasks");
  });

  it("handles hash with deep path like '#/tasks/abc123'", () => {
    window.location.hash = "#/tasks/abc123";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.path).toBe("/tasks/abc123");
  });

  it("navigate() sets window.location.hash", () => {
    const { result } = renderHook(() => useHashRoute());

    act(() => {
      result.current.navigate("/notes");
    });

    expect(window.location.hash).toBe("#/notes");
  });

  it("updates path state on hashchange event", async () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.path).toBe("/");

    act(() => {
      window.location.hash = "#/tasks";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() => {
      expect(result.current.path).toBe("/tasks");
    });
  });

  it("cleans up hashchange listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useHashRoute());

    // Find the hashchange listener that was added
    const hashchangeCall = addSpy.mock.calls.find(
      (call) => call[0] === "hashchange",
    );
    expect(hashchangeCall).toBeDefined();

    unmount();

    const removeCall = removeSpy.mock.calls.find(
      (call) => call[0] === "hashchange",
    );
    expect(removeCall).toBeDefined();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
