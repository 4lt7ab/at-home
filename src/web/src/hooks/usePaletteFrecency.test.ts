import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  usePaletteFrecency,
  STORAGE_KEY,
  HITS_PER_LOG_CAP,
  HALF_LIFE_MS,
} from "./usePaletteFrecency";

beforeEach(() => {
  localStorage.clear();
});

describe("usePaletteFrecency", () => {
  it("starts empty when localStorage has no key", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    expect(result.current.hitsFor("log-a")).toEqual([]);
    expect(result.current.score("log-a")).toBe(0);
  });

  it("record appends a hit and hitsFor returns it", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    result.current.record("log-a", 1000);
    expect(result.current.hitsFor("log-a")).toEqual([1000]);
  });

  it("record persists to localStorage under the documented key", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    result.current.record("log-a", 1000);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.entries["log-a"].hits).toEqual([1000]);
  });

  it("caps hits per log at HITS_PER_LOG_CAP, dropping oldest first", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    for (let i = 0; i < HITS_PER_LOG_CAP + 5; i++) {
      result.current.record("log-a", i);
    }
    const hits = result.current.hitsFor("log-a");
    expect(hits.length).toBe(HITS_PER_LOG_CAP);
    // Oldest (i = 0..4) are dropped; newest is preserved
    expect(hits[0]).toBe(5);
    expect(hits[hits.length - 1]).toBe(HITS_PER_LOG_CAP + 4);
  });

  it("prune drops entries for unknown log ids", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    result.current.record("log-a", 1000);
    result.current.record("log-b", 2000);
    result.current.record("log-c", 3000);

    result.current.prune(new Set(["log-a", "log-c"]));

    expect(result.current.hitsFor("log-a")).toEqual([1000]);
    expect(result.current.hitsFor("log-b")).toEqual([]);
    expect(result.current.hitsFor("log-c")).toEqual([3000]);
  });

  it("score ranks more-recent / more-frequent higher", () => {
    const { result } = renderHook(() => usePaletteFrecency());
    const now = 10 * HALF_LIFE_MS;

    // A: 1 recent hit
    result.current.record("log-a", now - 1000);

    // B: 3 older hits (one half-life ago)
    result.current.record("log-b", now - HALF_LIFE_MS);
    result.current.record("log-b", now - HALF_LIFE_MS);
    result.current.record("log-b", now - HALF_LIFE_MS);

    const scoreA = result.current.score("log-a", now);
    const scoreB = result.current.score("log-b", now);

    // B has 3 old hits → 3 × 0.5 = 1.5
    // A has 1 recent hit → ≈ 1.0
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it("localStorage write failure falls through cleanly", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => usePaletteFrecency());
    expect(() => result.current.record("log-a", 1000)).not.toThrow();
    spy.mockRestore();
  });

  it("localStorage read with junk JSON falls through to empty", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    const { result } = renderHook(() => usePaletteFrecency());
    expect(result.current.hitsFor("log-a")).toEqual([]);
  });

  it("localStorage read with wrong version falls through to empty", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, entries: { "log-a": { hits: [1] } } }),
    );
    const { result } = renderHook(() => usePaletteFrecency());
    expect(result.current.hitsFor("log-a")).toEqual([]);
  });

  it("returns a stable object across renders", () => {
    const { result, rerender } = renderHook(() => usePaletteFrecency());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
