import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useNotes } from "./useNotes";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { NoteSummary } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

vi.mock("../api", () => ({
  fetchNotes: vi.fn(),
}));

import { fetchNotes } from "../api";
const mockFetchNotes = vi.mocked(fetchNotes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function makeNote(overrides: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id: "note-1",
    task_id: null,
    title: "Test Note",
    has_content: false,
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

describe("useNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=true, empty notes array, and total=0", () => {
    mockFetchNotes.mockReturnValue(new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.notes).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("fetches data on mount and returns it", async () => {
    const notes = [makeNote({ id: "n1" }), makeNote({ id: "n2" })];
    mockFetchNotes.mockResolvedValue({ data: notes, total: 2 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toEqual(notes);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("passes params to fetchNotes", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();
    const params = { task_id: "task-1", limit: 50 };

    renderHook(() => useNotes(params), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledWith(params));
  });

  it("sets error string on fetch failure", async () => {
    mockFetchNotes.mockRejectedValue(new Error("Server error"));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Server error");
    expect(result.current.notes).toEqual([]);
  });

  it("sets fallback error for non-Error rejections", async () => {
    mockFetchNotes.mockRejectedValue("string error");
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load notes");
  });

  it("changing params triggers a new fetch", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ params }) => useNotes(params),
      { wrapper: Wrapper, initialProps: { params: { task_id: "t1" } } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchNotes).toHaveBeenCalledTimes(1);

    rerender({ params: { task_id: "t2" } });

    await waitFor(() => expect(mockFetchNotes).toHaveBeenCalledTimes(2));
    expect(mockFetchNotes).toHaveBeenLastCalledWith({ task_id: "t2" });
  });

  it("refetch function triggers a new fetch", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchNotes.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(mockFetchNotes.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("subscribes to note entity type only", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchNotes.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "note" });
    });

    await waitFor(() => expect(mockFetchNotes.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("does not refetch on home_task event (not subscribed)", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchNotes.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "home_task" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchNotes.mock.calls.length).toBe(callsBefore);
  });

  it("does not refetch on schedule event (not subscribed)", async () => {
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useNotes(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchNotes.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "updated", entity_type: "schedule" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchNotes.mock.calls.length).toBe(callsBefore);
  });
});
