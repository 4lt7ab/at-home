import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThrottledCallback } from "./useThrottledCallback";

describe("useThrottledCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the callback after the delay (trailing edge)", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 200));

    act(() => {
      result.current();
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("captures latest args when called multiple times within delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottledCallback((value: never) => fn(value), 200),
    );

    act(() => {
      (result.current as (v: string) => void)("first");
      (result.current as (v: string) => void)("second");
      (result.current as (v: string) => void)("third");
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });

  it("allows a second call after the delay window has passed", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));

    act(() => {
      result.current();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callback reference", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useThrottledCallback(cb, 200),
      { initialProps: { cb: fn1 as (...args: never[]) => void } },
    );

    act(() => {
      result.current();
    });

    rerender({ cb: fn2 as (...args: never[]) => void });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it("clears timer on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useThrottledCallback(fn, 200));

    act(() => {
      result.current();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fn).not.toHaveBeenCalled();
  });
});
