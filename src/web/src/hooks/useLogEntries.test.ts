import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useLogEntries } from "./useLogEntries";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";

vi.mock("../api", () => ({
  fetchLogEntries: vi.fn(),
}));

import { fetchLogEntries } from "../api";
const mockFetchLogEntries = vi.mocked(fetchLogEntries);

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

describe("useLogEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes log_id to fetch call", async () => {
    mockFetchLogEntries.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();
    renderHook(() => useLogEntries("log-xyz"), { wrapper: Wrapper });
    await waitFor(() => expect(mockFetchLogEntries).toHaveBeenCalledWith("log-xyz", {}));
  });

  it("does not fetch when logId is null", () => {
    mockFetchLogEntries.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();
    renderHook(() => useLogEntries(null), { wrapper: Wrapper });
    expect(mockFetchLogEntries).not.toHaveBeenCalled();
  });

  it("refetches on log_entry events only", async () => {
    mockFetchLogEntries.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();
    const { result } = renderHook(() => useLogEntries("log-1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchLogEntries.mock.calls.length;
    act(() => { getOnEvent()({ type: "created", entity_type: "log" }); });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchLogEntries.mock.calls.length).toBe(callsBefore);

    act(() => { getOnEvent()({ type: "created", entity_type: "log_entry" }); });
    await waitFor(() => expect(mockFetchLogEntries.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
