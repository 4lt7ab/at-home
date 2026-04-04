import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useHotkey } from "./useHotkey";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useHotkey", () => {
  it("calls callback when key and modifiers match", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    fireEvent.keyDown(window, { key: "G", shiftKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not call callback when key does not match", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    fireEvent.keyDown(window, { key: "h", shiftKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not call callback when modifier mismatch (Ctrl held but not expected)", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    fireEvent.keyDown(window, { key: "G", shiftKey: true, ctrlKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("requires exact modifier match (Shift+G does not fire when Shift+Ctrl+G pressed)", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    fireEvent.keyDown(window, { key: "G", shiftKey: true, ctrlKey: true, metaKey: false, altKey: false });
    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores events from INPUT elements", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: "G", shiftKey: true });
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("ignores events from TEXTAREA elements", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireEvent.keyDown(textarea, { key: "G", shiftKey: true });
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it("ignores events from SELECT elements", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    const select = document.createElement("select");
    document.body.appendChild(select);

    fireEvent.keyDown(select, { key: "G", shiftKey: true });
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(select);
  });

  it("ignores events from contentEditable elements", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    const div = document.createElement("div");
    div.contentEditable = "true";
    // jsdom does not implement isContentEditable, so we must define it manually
    Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });
    document.body.appendChild(div);

    const event = new KeyboardEvent("keydown", {
      key: "G",
      shiftKey: true,
      bubbles: true,
    });
    div.dispatchEvent(event);
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("calls preventDefault on match", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("g", { shift: true }, callback));

    const event = new KeyboardEvent("keydown", {
      key: "G",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  it("uses latest callback via ref (callback identity can change without re-registering)", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useHotkey("g", { shift: true }, cb),
      { initialProps: { cb: callback1 } },
    );

    rerender({ cb: callback2 });

    fireEvent.keyDown(window, { key: "G", shiftKey: true });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("removes listener on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useHotkey("g", { shift: true }, callback));

    unmount();

    fireEvent.keyDown(window, { key: "G", shiftKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("fires for keys without modifiers when none specified", () => {
    const callback = vi.fn();
    renderHook(() => useHotkey("?", {}, callback));

    fireEvent.keyDown(window, { key: "?" });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
