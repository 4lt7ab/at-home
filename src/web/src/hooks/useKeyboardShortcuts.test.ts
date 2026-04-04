import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, fireEvent } from "@testing-library/react";
import {
  useShortcut,
  useShortcutSuppression,
  useRegisteredShortcuts,
  _resetShortcutManager,
  _getSuppressionCount,
} from "./useKeyboardShortcuts";

beforeEach(() => {
  _resetShortcutManager();
});

afterEach(() => {
  _resetShortcutManager();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useShortcut
// ---------------------------------------------------------------------------

describe("useShortcut", () => {
  it("fires callback on matching key press", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("?", "Show help", cb));

    fireEvent.keyDown(window, { key: "?" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires callback for modifier combos (shift+g)", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("shift+g", "Toggle gallery", cb));

    fireEvent.keyDown(window, { key: "g", shiftKey: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire when key does not match", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("?", "Show help", cb));

    fireEvent.keyDown(window, { key: "a" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire when modifier mismatch", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("shift+g", "Toggle", cb));

    // Press g without shift
    fireEvent.keyDown(window, { key: "g" });
    expect(cb).not.toHaveBeenCalled();

    // Press shift+g with extra ctrl
    fireEvent.keyDown(window, { key: "g", shiftKey: true, ctrlKey: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it("calls preventDefault on match", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("?", "Help", cb));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      bubbles: true,
      cancelable: true,
    });
    const spy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
    expect(cb).toHaveBeenCalled();
  });

  it("uses latest callback via ref (no stale closure)", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useShortcut("n", "New", cb, "Actions"),
      { initialProps: { cb: cb1 } },
    );

    rerender({ cb: cb2 });

    fireEvent.keyDown(window, { key: "n" });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("unregisters on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useShortcut("n", "New", cb));

    unmount();

    fireEvent.keyDown(window, { key: "n" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("handles Escape key", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("escape", "Close", cb));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("handles ctrl+s", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("ctrl+s", "Save", cb));

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("handles meta+s (Cmd on Mac)", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("meta+s", "Save", cb));

    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Two-key sequences
// ---------------------------------------------------------------------------

describe("two-key sequences", () => {
  it("fires callback for two-key sequence (g h)", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("g h", "Go home", cb, "Navigation"));

    fireEvent.keyDown(window, { key: "g" });
    expect(cb).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "h" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire if wrong second key", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("g h", "Go home", cb, "Navigation"));

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "x" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("sequence resets after timeout", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    renderHook(() => useShortcut("g h", "Go home", cb, "Navigation"));

    fireEvent.keyDown(window, { key: "g" });
    vi.advanceTimersByTime(900); // past 800ms timeout
    fireEvent.keyDown(window, { key: "h" });
    expect(cb).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("single-key shortcut still works alongside sequences", () => {
    const seqCb = vi.fn();
    const singleCb = vi.fn();
    renderHook(() => useShortcut("g h", "Go home", seqCb, "Navigation"));
    renderHook(() => useShortcut("?", "Help", singleCb));

    fireEvent.keyDown(window, { key: "?" });
    expect(singleCb).toHaveBeenCalledTimes(1);
    expect(seqCb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Input/textarea/select suppression
// ---------------------------------------------------------------------------

describe("input element suppression", () => {
  it("skips when INPUT is focused", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));

    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: "n" });
    expect(cb).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("skips when TEXTAREA is focused", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireEvent.keyDown(textarea, { key: "n" });
    expect(cb).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it("skips when SELECT is focused", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));

    const select = document.createElement("select");
    document.body.appendChild(select);

    fireEvent.keyDown(select, { key: "n" });
    expect(cb).not.toHaveBeenCalled();

    document.body.removeChild(select);
  });

  it("skips when contentEditable is focused", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));

    const div = document.createElement("div");
    div.contentEditable = "true";
    Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });
    document.body.appendChild(div);

    const event = new KeyboardEvent("keydown", { key: "n", bubbles: true });
    div.dispatchEvent(event);
    expect(cb).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});

// ---------------------------------------------------------------------------
// useShortcutSuppression
// ---------------------------------------------------------------------------

describe("useShortcutSuppression", () => {
  it("prevents shortcuts when active", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));
    renderHook(() => useShortcutSuppression(true));

    fireEvent.keyDown(window, { key: "n" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("allows shortcuts when not active", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));
    renderHook(() => useShortcutSuppression(false));

    fireEvent.keyDown(window, { key: "n" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("ref-counter: multiple suppressions require all to deactivate", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));

    const { rerender: rerender1 } = renderHook(
      ({ active }) => useShortcutSuppression(active),
      { initialProps: { active: true } },
    );
    const { rerender: rerender2 } = renderHook(
      ({ active }) => useShortcutSuppression(active),
      { initialProps: { active: true } },
    );

    expect(_getSuppressionCount()).toBe(2);

    // Deactivate one
    rerender1({ active: false });
    expect(_getSuppressionCount()).toBe(1);

    // Still suppressed
    fireEvent.keyDown(window, { key: "n" });
    expect(cb).not.toHaveBeenCalled();

    // Deactivate the other
    rerender2({ active: false });
    expect(_getSuppressionCount()).toBe(0);

    fireEvent.keyDown(window, { key: "n" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cleans up suppression on unmount", () => {
    const cb = vi.fn();
    renderHook(() => useShortcut("n", "New", cb));
    const { unmount } = renderHook(() => useShortcutSuppression(true));

    expect(_getSuppressionCount()).toBe(1);

    unmount();

    expect(_getSuppressionCount()).toBe(0);
    fireEvent.keyDown(window, { key: "n" });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useRegisteredShortcuts
// ---------------------------------------------------------------------------

describe("useRegisteredShortcuts", () => {
  it("returns registered shortcuts grouped by scope", () => {
    renderHook(() => useShortcut("n", "New item", vi.fn(), "Actions"));
    renderHook(() => useShortcut("g h", "Go home", vi.fn(), "Navigation"));
    renderHook(() => useShortcut("?", "Show help", vi.fn(), "General"));

    const { result } = renderHook(() => useRegisteredShortcuts());
    const grouped = result.current;

    expect(grouped.has("Actions")).toBe(true);
    expect(grouped.has("Navigation")).toBe(true);
    expect(grouped.has("General")).toBe(true);

    expect(grouped.get("Actions")!.length).toBe(1);
    expect(grouped.get("Actions")![0].keys).toBe("n");
    expect(grouped.get("Actions")![0].description).toBe("New item");

    expect(grouped.get("Navigation")![0].keys).toBe("g h");
  });

  it("updates when shortcuts are added/removed", () => {
    const { result } = renderHook(() => useRegisteredShortcuts());
    expect(result.current.size).toBe(0);

    const { unmount } = renderHook(() => useShortcut("n", "New", vi.fn(), "Actions"));
    expect(result.current.has("Actions")).toBe(true);

    unmount();
    expect(result.current.size).toBe(0);
  });

  it("deduplicates same keys+scope", () => {
    renderHook(() => useShortcut("n", "New item", vi.fn(), "Actions"));
    renderHook(() => useShortcut("n", "New item", vi.fn(), "Actions"));

    const { result } = renderHook(() => useRegisteredShortcuts());
    expect(result.current.get("Actions")!.length).toBe(1);
  });

  it("defaults scope to General", () => {
    renderHook(() => useShortcut("?", "Help", vi.fn()));

    const { result } = renderHook(() => useRegisteredShortcuts());
    expect(result.current.has("General")).toBe(true);
  });
});
