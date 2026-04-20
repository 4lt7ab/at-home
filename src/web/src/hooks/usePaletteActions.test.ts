import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  firePaletteAction,
  usePaletteAction,
  _resetPaletteActions,
  _paletteActionListenerCount,
} from "./usePaletteActions";

beforeEach(() => {
  _resetPaletteActions();
});

afterEach(() => {
  _resetPaletteActions();
});

describe("usePaletteAction", () => {
  it("fires the subscribed listener when firePaletteAction runs", () => {
    const cb = vi.fn();
    renderHook(() => usePaletteAction("new-note", cb));

    firePaletteAction("new-note");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire listeners registered for a different action", () => {
    const newNote = vi.fn();
    const newLog = vi.fn();
    renderHook(() => usePaletteAction("new-note", newNote));
    renderHook(() => usePaletteAction("new-log", newLog));

    firePaletteAction("new-note");
    expect(newNote).toHaveBeenCalledTimes(1);
    expect(newLog).not.toHaveBeenCalled();
  });

  it("supports multiple listeners on the same action", () => {
    const a = vi.fn();
    const b = vi.fn();
    renderHook(() => usePaletteAction("new-reminder", a));
    renderHook(() => usePaletteAction("new-reminder", b));

    firePaletteAction("new-reminder");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when the component unmounts", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => usePaletteAction("new-note", cb));

    expect(_paletteActionListenerCount("new-note")).toBe(1);
    unmount();
    expect(_paletteActionListenerCount("new-note")).toBe(0);

    firePaletteAction("new-note");
    expect(cb).not.toHaveBeenCalled();
  });

  it("firing an action with no listeners is a no-op", () => {
    expect(() => firePaletteAction("new-note")).not.toThrow();
  });

  it("drains a recent pending fire when a listener subscribes afterward", async () => {
    // Fire BEFORE any listener is registered (e.g. palette navigates to a
    // page that hasn't mounted yet). The pending queue holds it, and the
    // listener receives it on subscribe.
    firePaletteAction("new-note");

    const cb = vi.fn();
    renderHook(() => usePaletteAction("new-note", cb));

    // Microtask flush
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
