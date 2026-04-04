import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { useTask } from "./useTask";
import { EventSubscriptionContext, useEventFanOut } from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";
import type { HomeTask, Note, ScheduleSummary, NoteSummary, ActivityLog } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

vi.mock("../api", () => ({
  fetchTask: vi.fn(),
  fetchNote: vi.fn(),
  fetchNotes: vi.fn(),
  fetchSchedules: vi.fn(),
  fetchActivityLog: vi.fn(),
}));

import { fetchTask, fetchNote, fetchNotes, fetchSchedules, fetchActivityLog } from "../api";
const mockFetchTask = vi.mocked(fetchTask);
const mockFetchNote = vi.mocked(fetchNote);
const mockFetchNotes = vi.mocked(fetchNotes);
const mockFetchSchedules = vi.mocked(fetchSchedules);
const mockFetchActivityLog = vi.mocked(fetchActivityLog);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function makeHomeTask(overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    id: "task-1",
    title: "Test Task",
    description: null,
    status: "active",
    area: null,
    effort: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    task_id: "task-1",
    title: "Test Note",
    content: "Some content",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeScheduleSummary(overrides: Partial<ScheduleSummary> = {}): ScheduleSummary {
  return {
    id: "sched-1",
    task_id: "task-1",
    recurrence_type: "daily",
    next_due: "2026-04-03",
    last_completed: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeActivityLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "act-1",
    entity_type: "home_task",
    entity_id: "task-1",
    action: "created",
    summary: "Task created",
    created_at: NOW,
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

function setupDefaultMocks() {
  mockFetchTask.mockResolvedValue(makeHomeTask());
  mockFetchSchedules.mockResolvedValue({ data: [makeScheduleSummary()], total: 1 });
  mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
  mockFetchActivityLog.mockResolvedValue({ data: [], total: 0 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=true and task=null", () => {
    mockFetchTask.mockReturnValue(new Promise(() => {}));
    mockFetchSchedules.mockReturnValue(new Promise(() => {}));
    mockFetchNotes.mockReturnValue(new Promise(() => {}));
    mockFetchActivityLog.mockReturnValue(new Promise(() => {}));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.task).toBeNull();
    expect(result.current.schedules).toEqual([]);
    expect(result.current.notes).toEqual([]);
    expect(result.current.completionHistory).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fetches from 4 endpoints on mount", async () => {
    setupDefaultMocks();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchTask).toHaveBeenCalledWith("task-1");
    expect(mockFetchSchedules).toHaveBeenCalledWith({ task_id: "task-1" });
    expect(mockFetchNotes).toHaveBeenCalledWith({ task_id: "task-1" });
    expect(mockFetchActivityLog).toHaveBeenCalledWith({ entity_type: "home_task", entity_id: "task-1", limit: 50 });
  });

  it("returns task, schedules, and empty notes when no notes exist", async () => {
    setupDefaultMocks();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.task).toEqual(makeHomeTask());
    expect(result.current.schedules).toEqual([makeScheduleSummary()]);
    expect(result.current.notes).toEqual([]);
  });

  it("fetches full notes individually when notes exist", async () => {
    const noteSummaries: NoteSummary[] = [
      { id: "n1", task_id: "task-1", title: "Note 1", has_content: true, created_at: NOW, updated_at: NOW },
      { id: "n2", task_id: "task-1", title: "Note 2", has_content: false, created_at: NOW, updated_at: NOW },
    ];
    const fullNote1 = makeNote({ id: "n1", title: "Note 1", content: "Full content 1" });
    const fullNote2 = makeNote({ id: "n2", title: "Note 2", content: null });

    mockFetchTask.mockResolvedValue(makeHomeTask());
    mockFetchSchedules.mockResolvedValue({ data: [], total: 0 });
    mockFetchNotes.mockResolvedValue({ data: noteSummaries, total: 2 });
    mockFetchActivityLog.mockResolvedValue({ data: [], total: 0 });
    mockFetchNote.mockImplementation((id: string) => {
      if (id === "n1") return Promise.resolve(fullNote1);
      return Promise.resolve(fullNote2);
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchNote).toHaveBeenCalledTimes(2);
    expect(result.current.notes).toEqual([fullNote1, fullNote2]);
  });

  it("falls back to summary data if individual note fetches fail", async () => {
    const noteSummaries: NoteSummary[] = [
      { id: "n1", task_id: "task-1", title: "Note 1", has_content: true, created_at: NOW, updated_at: NOW },
    ];

    mockFetchTask.mockResolvedValue(makeHomeTask());
    mockFetchSchedules.mockResolvedValue({ data: [], total: 0 });
    mockFetchNotes.mockResolvedValue({ data: noteSummaries, total: 1 });
    mockFetchActivityLog.mockResolvedValue({ data: [], total: 0 });
    mockFetchNote.mockRejectedValue(new Error("Not found"));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Falls back to summary cast as Note[]
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].id).toBe("n1");
  });

  it("filters completionHistory for action=completed", async () => {
    const activity: ActivityLog[] = [
      makeActivityLog({ id: "a1", action: "created", summary: "Task created" }),
      makeActivityLog({ id: "a2", action: "completed", summary: '{"next_due":"2026-04-10"}' }),
      makeActivityLog({ id: "a3", action: "updated", summary: "Task updated" }),
      makeActivityLog({ id: "a4", action: "completed", summary: '{"next_due":null}' }),
    ];

    mockFetchTask.mockResolvedValue(makeHomeTask());
    mockFetchSchedules.mockResolvedValue({ data: [], total: 0 });
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    mockFetchActivityLog.mockResolvedValue({ data: activity, total: 4 });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.completionHistory).toHaveLength(2);
    expect(result.current.completionHistory[0].action).toBe("completed");
    expect(result.current.completionHistory[1].action).toBe("completed");
  });

  it("sets error when any endpoint fails", async () => {
    mockFetchTask.mockRejectedValue(new Error("Not found"));
    mockFetchSchedules.mockResolvedValue({ data: [], total: 0 });
    mockFetchNotes.mockResolvedValue({ data: [], total: 0 });
    mockFetchActivityLog.mockResolvedValue({ data: [], total: 0 });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Not found");
    expect(result.current.task).toBeNull();
  });

  it("refetch triggers a new fetch", async () => {
    setupDefaultMocks();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTask.mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(mockFetchTask.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("changing id triggers refetch", async () => {
    setupDefaultMocks();
    const { Wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ id }) => useTask(id),
      { wrapper: Wrapper, initialProps: { id: "task-1" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchTask).toHaveBeenCalledWith("task-1");

    rerender({ id: "task-2" });

    await waitFor(() => expect(mockFetchTask).toHaveBeenCalledWith("task-2"));
  });

  it("subscribes to home_task, schedule, and note events", async () => {
    setupDefaultMocks();
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Test each subscribed entity type
    for (const entityType of ["home_task", "schedule", "note"]) {
      const callsBefore = mockFetchTask.mock.calls.length;
      act(() => {
        getOnEvent()({ type: "updated", entity_type: entityType });
      });
      await waitFor(() => expect(mockFetchTask.mock.calls.length).toBeGreaterThan(callsBefore));
    }
  });

  it("does not refetch on non-matching entity type", async () => {
    setupDefaultMocks();
    const { Wrapper, getOnEvent } = createWrapper();

    const { result } = renderHook(() => useTask("task-1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockFetchTask.mock.calls.length;

    act(() => {
      getOnEvent()({ type: "created", entity_type: "other_entity" });
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchTask.mock.calls.length).toBe(callsBefore);
  });
});
