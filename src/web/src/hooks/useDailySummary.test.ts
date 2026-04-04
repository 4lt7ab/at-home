import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useDailySummary } from "./useDailySummary";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { DailySummary } from "@domain/summary";

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

vi.mock("../api", () => ({
  fetchDailySummary: vi.fn(),
}));

import { fetchDailySummary } from "../api";
const mockFetchDailySummary = vi.mocked(fetchDailySummary);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function makeSummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date: "2026-04-03",
    overdue: [],
    due_today: [],
    upcoming: [],
    counts: { overdue: 0, due_today: 0, upcoming: 0, total: 0 },
    ...overrides,
  };
}

function createWrapper() {
  let onEvent: ((e: DomainEvent) => void) | null = null;

  function Wrapper({ children }: { children: React.ReactNode }) {
    const fanOut = useEventFanOut();
    onEvent = fanOut.onEvent;
    return React.createElement(
      EventSubscriptionContext.Provider,
      { value: { subscribeEvents: fanOut.subscribeEvents, connected: true } },
      children,
    );
  }

  return { Wrapper, getOnEvent: () => onEvent! };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDailySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=true and summary=null", () => {
    mockFetchDailySummary.mockReturnValue(new Promise(() => {})); // never resolves
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches data on mount and returns it", async () => {
    const summary = makeSummary();
    mockFetchDailySummary.mockResolvedValue(summary);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toEqual(summary);
    expect(result.current.error).toBeNull();
    expect(mockFetchDailySummary).toHaveBeenCalledWith(undefined, undefined);
  });

  it("passes date and lookahead params to fetchDailySummary", async () => {
    mockFetchDailySummary.mockResolvedValue(makeSummary());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDailySummary("2026-05-01", 7), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchDailySummary).toHaveBeenCalledWith("2026-05-01", 7);
  });

  it("sets error string on fetch failure", async () => {
    mockFetchDailySummary.mockRejectedValue(new Error("Network fail"));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network fail");
    expect(result.current.summary).toBeNull();
  });

  it("sets fallback error for non-Error rejections", async () => {
    mockFetchDailySummary.mockRejectedValue("some string");
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load summary");
  });

  it("refetch function triggers a new fetch", async () => {
    const summary1 = makeSummary({ date: "2026-04-03" });
    const summary2 = makeSummary({ date: "2026-04-04" });
    mockFetchDailySummary.mockResolvedValueOnce(summary1).mockResolvedValueOnce(summary2);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toEqual(summary1);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.summary).toEqual(summary2));
    expect(mockFetchDailySummary).toHaveBeenCalledTimes(2);
  });

  it("entity subscription triggers refetch on matching event (home_task)", async () => {
    mockFetchDailySummary.mockResolvedValue(makeSummary());
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCount = mockFetchDailySummary.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "home_task" });
    });

    await waitFor(() => expect(mockFetchDailySummary.mock.calls.length).toBeGreaterThan(callCount));
  });

  it("entity subscription triggers refetch on schedule event", async () => {
    mockFetchDailySummary.mockResolvedValue(makeSummary());
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCount = mockFetchDailySummary.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "updated", entity_type: "schedule" });
    });

    await waitFor(() => expect(mockFetchDailySummary.mock.calls.length).toBeGreaterThan(callCount));
  });

  it("entity subscription triggers refetch on note event", async () => {
    mockFetchDailySummary.mockResolvedValue(makeSummary());
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCount = mockFetchDailySummary.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "note" });
    });

    await waitFor(() => expect(mockFetchDailySummary.mock.calls.length).toBeGreaterThan(callCount));
  });

  it("does not refetch on non-matching entity type event", async () => {
    mockFetchDailySummary.mockResolvedValue(makeSummary());
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useDailySummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCount = mockFetchDailySummary.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "other_entity" });
    });

    // Wait a tick and verify no additional calls
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchDailySummary.mock.calls.length).toBe(callCount);
  });
});
