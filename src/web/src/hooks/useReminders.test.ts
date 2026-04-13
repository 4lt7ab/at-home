import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useReminders } from "./useReminders";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { ReminderSummary } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

vi.mock("../api", () => ({
  fetchReminders: vi.fn(),
}));

import { fetchReminders } from "../api";
const mockFetchReminders = vi.mocked(fetchReminders);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";
const TOMORROW = "2026-04-04T09:00:00.000Z";

function makeReminder(overrides: Partial<ReminderSummary> = {}): ReminderSummary {
  return {
    id: "reminder-1",
    context: "Test reminder",
    context_preview: "Test reminder",
    remind_at: TOMORROW,
    recurrence: null,
    dismissed_at: null,
    is_active: true,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=true, empty reminders array, and total=0", () => {
    mockFetchReminders.mockReturnValue(new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.reminders).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("fetches data on mount and returns it", async () => {
    const reminders = [makeReminder({ id: "r1" }), makeReminder({ id: "r2" })];
    mockFetchReminders.mockResolvedValue({ data: reminders, total: 2 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reminders).toEqual(reminders);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("passes params to fetchReminders", async () => {
    mockFetchReminders.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();
    const params = { context: "search", limit: 50 };

    renderHook(() => useReminders(params), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetchReminders).toHaveBeenCalledWith(params));
  });

  it("sets error string on fetch failure", async () => {
    mockFetchReminders.mockRejectedValue(new Error("Server error"));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Server error");
    expect(result.current.reminders).toEqual([]);
  });

  it("sets fallback error for non-Error rejections", async () => {
    mockFetchReminders.mockRejectedValue("string error");
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load reminders");
  });

  it("changing params triggers a new fetch", async () => {
    mockFetchReminders.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ params }) => useReminders(params),
      { wrapper: Wrapper, initialProps: { params: { context: "a" } } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchReminders).toHaveBeenCalledTimes(1);

    rerender({ params: { context: "b" } });

    await waitFor(() => expect(mockFetchReminders).toHaveBeenCalledTimes(2));
    expect(mockFetchReminders).toHaveBeenLastCalledWith({ context: "b" });
  });

  it("refetch function triggers a new fetch", async () => {
    mockFetchReminders.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchReminders.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(mockFetchReminders.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("subscribes to reminder entity type only", async () => {
    mockFetchReminders.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchReminders.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "reminder" });
    });

    await waitFor(() => expect(mockFetchReminders.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("does not refetch on unrelated entity events", async () => {
    mockFetchReminders.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useReminders(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchReminders.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "note" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchReminders.mock.calls.length).toBe(callsBefore);
  });
});
