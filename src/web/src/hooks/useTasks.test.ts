import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useTasks } from "./useTasks";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { HomeTaskSummary } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

vi.mock("../api", () => ({
  fetchTasks: vi.fn(),
}));

import { fetchTasks } from "../api";
const mockFetchTasks = vi.mocked(fetchTasks);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function makeTask(overrides: Partial<HomeTaskSummary> = {}): HomeTaskSummary {
  return {
    id: "task-1",
    title: "Test Task",
    status: "active",
    area: null,
    effort: null,
    has_description: false,
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

describe("useTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=true, empty tasks array, and total=0", () => {
    mockFetchTasks.mockReturnValue(new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("fetches data on mount and returns it", async () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    mockFetchTasks.mockResolvedValue({ data: tasks, total: 2 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual(tasks);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("passes params to fetchTasks", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();
    const params = { status: "active", area: "kitchen" };

    renderHook(() => useTasks(params), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledWith(params));
  });

  it("sets error string on fetch failure", async () => {
    mockFetchTasks.mockRejectedValue(new Error("Server error"));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Server error");
    expect(result.current.tasks).toEqual([]);
  });

  it("changing params triggers a new fetch", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ params }) => useTasks(params),
      { wrapper: Wrapper, initialProps: { params: { status: "active" } } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);

    rerender({ params: { status: "paused" } });

    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(2));
    expect(mockFetchTasks).toHaveBeenLastCalledWith({ status: "paused" });
  });

  it("refetch function triggers a new fetch", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTasks.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(mockFetchTasks.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("entity subscription triggers refetch on home_task event", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTasks.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "home_task" });
    });

    await waitFor(() => expect(mockFetchTasks.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("entity subscription triggers refetch on schedule event", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTasks.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "updated", entity_type: "schedule" });
    });

    await waitFor(() => expect(mockFetchTasks.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("does not refetch on note event (not subscribed)", async () => {
    mockFetchTasks.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTasks.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "note" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchTasks.mock.calls.length).toBe(callsBefore);
  });
});
