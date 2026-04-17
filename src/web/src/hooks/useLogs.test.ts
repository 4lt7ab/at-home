import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useLogs } from "./useLogs";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { LogSummary } from "@domain/entities";

vi.mock("../api", () => ({
  fetchLogs: vi.fn(),
}));

import { fetchLogs } from "../api";
const mockFetchLogs = vi.mocked(fetchLogs);

const NOW = "2026-04-03T12:00:00.000Z";

function makeLog(overrides: Partial<LogSummary> = {}): LogSummary {
  return {
    id: "log-1",
    name: "Test log",
    description: null,
    last_logged_at: null,
    entry_count: 0,
    created_at: NOW,
    updated_at: NOW,
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

describe("useLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches logs on mount", async () => {
    mockFetchLogs.mockResolvedValue({ data: [makeLog()], total: 1 });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useLogs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logs.length).toBe(1);
    expect(result.current.total).toBe(1);
  });

  it("refetches on log events", async () => {
    mockFetchLogs.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();
    const { result } = renderHook(() => useLogs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchLogs.mock.calls.length;
    act(() => { getOnEvent()({ type: "created", entity_type: "log" }); });
    await waitFor(() => expect(mockFetchLogs.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("refetches on log_entry events (for last_logged_at updates)", async () => {
    mockFetchLogs.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();
    const { result } = renderHook(() => useLogs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchLogs.mock.calls.length;
    act(() => { getOnEvent()({ type: "created", entity_type: "log_entry" }); });
    await waitFor(() => expect(mockFetchLogs.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("ignores unrelated events", async () => {
    mockFetchLogs.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();
    const { result } = renderHook(() => useLogs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchLogs.mock.calls.length;
    act(() => { getOnEvent()({ type: "created", entity_type: "reminder" }); });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchLogs.mock.calls.length).toBe(callsBefore);
  });

  it("surfaces fetch errors", async () => {
    mockFetchLogs.mockRejectedValue(new Error("boom"));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useLogs(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("boom");
  });
});
