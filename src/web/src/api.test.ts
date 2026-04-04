import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  apiFetch,
  fetchDailySummary,
  completeTask,
  fetchTasks,
  fetchTask,
  createTasks,
  updateTasks,
  deleteTasks,
  fetchNotes,
  fetchNote,
  createNotes,
  updateNotes,
  deleteNotes,
  fetchSchedules,
  fetchSchedule,
  createSchedules,
  updateSchedules,
  deleteSchedules,
  fetchActivityLog,
} from "./api";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("has correct name, message, and status properties", () => {
    const err = new ApiError("something broke", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("something broke");
    expect(err.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

describe("apiFetch", () => {
  it("returns Response on successful fetch", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
    const res = await apiFetch("/api/test");
    expect(res).toBeInstanceOf(Response);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("throws ApiError with status 0 on network error", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    try {
      await apiFetch("/api/test");
    } catch (err) {
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).message).toContain("Network error");
    }
  });

  it("throws ApiError with server message on 400 response with { error } body", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Validation failed" }, 400),
    );
    try {
      await apiFetch("/api/test");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).message).toBe("Validation failed");
    }
  });

  it("throws ApiError with generic message on 500 response with unparseable body", async () => {
    mockFetch.mockResolvedValue(errorResponse("not json!", 500));
    await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    try {
      await apiFetch("/api/test");
    } catch (err) {
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).message).toBe("Request failed (500)");
    }
  });

  it("throws ApiError with generic message when body.error is missing", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ other: "field" }, 404));
    try {
      await apiFetch("/api/test");
    } catch (err) {
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).message).toBe("Request failed (404)");
    }
  });
});

// ---------------------------------------------------------------------------
// qs — tested indirectly through API functions
// ---------------------------------------------------------------------------

describe("query string building (via fetchTasks)", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
  });

  it("sends no query string when params omitted", async () => {
    await fetchTasks();
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", undefined);
  });

  it("builds query string from string params", async () => {
    await fetchTasks({ status: "active", area: "kitchen" });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("status=active");
    expect(url).toContain("area=kitchen");
  });

  it("skips null and undefined values", async () => {
    await fetchTasks({ status: undefined, area: undefined });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toBe("/api/tasks");
  });

  it("coerces numbers and booleans to strings", async () => {
    await fetchTasks({ limit: 10, offset: 0 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=0");
  });
});

// ---------------------------------------------------------------------------
// Daily Summary API
// ---------------------------------------------------------------------------

describe("fetchDailySummary", () => {
  it("calls /api/summary with no params when date/lookahead omitted", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ date: "2026-04-03", overdue: [], due_today: [], upcoming: [], counts: {} }));
    await fetchDailySummary();
    expect(mockFetch.mock.calls[0][0]).toBe("/api/summary");
  });

  it("passes date and lookahead_days as query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ date: "2026-04-03", overdue: [], due_today: [], upcoming: [], counts: {} }));
    await fetchDailySummary("2026-04-03", 7);
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("date=2026-04-03");
    expect(url).toContain("lookahead_days=7");
  });

  it("returns parsed JSON", async () => {
    const summary = { date: "2026-04-03", overdue: [], due_today: [], upcoming: [], counts: { overdue: 0, due_today: 0, upcoming: 0, total: 0 } };
    mockFetch.mockResolvedValue(jsonResponse(summary));
    const result = await fetchDailySummary();
    expect(result).toEqual(summary);
  });
});

// ---------------------------------------------------------------------------
// completeTask
// ---------------------------------------------------------------------------

describe("completeTask", () => {
  it("POSTs to /api/summary/complete with { task_id, note }", async () => {
    const response = { task: {}, schedule: null, next_due: null, completed_at: "2026-04-03", note_created: null };
    mockFetch.mockResolvedValue(jsonResponse(response));
    await completeTask("task-1", "Done cleaning");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/summary/complete");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.task_id).toBe("task-1");
    expect(body.note).toBe("Done cleaning");
  });

  it("includes note as undefined when not provided", async () => {
    const response = { task: {}, schedule: null, next_due: null, completed_at: "2026-04-03", note_created: null };
    mockFetch.mockResolvedValue(jsonResponse(response));
    await completeTask("task-1");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.task_id).toBe("task-1");
    // note is passed as undefined which JSON.stringify omits
    expect(body).not.toHaveProperty("note");
  });
});

// ---------------------------------------------------------------------------
// Entity CRUD — Tasks
// ---------------------------------------------------------------------------

describe("Tasks API", () => {
  it("fetchTasks: GET /api/tasks with query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchTasks({ status: "active", limit: 5 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/tasks?");
    expect(url).toContain("status=active");
    expect(url).toContain("limit=5");
    // GET has no request init
    expect(mockFetch.mock.calls[0][1]).toBeUndefined();
  });

  it("fetchTask: GET /api/tasks/{id} with encoded ID", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "a/b" }));
    await fetchTask("a/b");
    expect(mockFetch.mock.calls[0][0]).toBe("/api/tasks/a%2Fb");
  });

  it("createTasks: POST /api/tasks with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "1", title: "T" }]));
    await createTasks([{ title: "T" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ items: [{ title: "T" }] });
  });

  it("updateTasks: PATCH /api/tasks with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "1", title: "Updated" }]));
    await updateTasks([{ id: "1", title: "Updated" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ items: [{ id: "1", title: "Updated" }] });
  });

  it("deleteTasks: DELETE /api/tasks with { ids: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null));
    await deleteTasks(["id-1", "id-2"]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ ids: ["id-1", "id-2"] });
  });

  it("createTasks: sends empty items array", async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await createTasks([]);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ items: [] });
  });
});

// ---------------------------------------------------------------------------
// Entity CRUD — Notes
// ---------------------------------------------------------------------------

describe("Notes API", () => {
  it("fetchNotes: GET /api/notes with query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchNotes({ task_id: "t1", limit: 10 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/notes?");
    expect(url).toContain("task_id=t1");
    expect(url).toContain("limit=10");
  });

  it("fetchNote: GET /api/notes/{id} with encoded ID", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "x&y" }));
    await fetchNote("x&y");
    expect(mockFetch.mock.calls[0][0]).toBe("/api/notes/x%26y");
  });

  it("createNotes: POST /api/notes with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "n1" }]));
    await createNotes([{ title: "My Note" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/notes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ items: [{ title: "My Note" }] });
  });

  it("updateNotes: PATCH /api/notes with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "n1" }]));
    await updateNotes([{ id: "n1", title: "Updated" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/notes");
    expect(init.method).toBe("PATCH");
  });

  it("deleteNotes: DELETE /api/notes with { ids: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null));
    await deleteNotes(["n1"]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/notes");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ ids: ["n1"] });
  });
});

// ---------------------------------------------------------------------------
// Entity CRUD — Schedules
// ---------------------------------------------------------------------------

describe("Schedules API", () => {
  it("fetchSchedules: GET /api/schedules with query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchSchedules({ task_id: "t1" });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/schedules?");
    expect(url).toContain("task_id=t1");
  });

  it("fetchSchedule: GET /api/schedules/{id} with encoded ID", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "s=1" }));
    await fetchSchedule("s=1");
    expect(mockFetch.mock.calls[0][0]).toBe("/api/schedules/s%3D1");
  });

  it("createSchedules: POST /api/schedules with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "s1" }]));
    await createSchedules([{ task_id: "t1", recurrence_type: "daily" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/schedules");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ items: [{ task_id: "t1", recurrence_type: "daily" }] });
  });

  it("updateSchedules: PATCH /api/schedules with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "s1" }]));
    await updateSchedules([{ id: "s1", recurrence_type: "weekly" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/schedules");
    expect(init.method).toBe("PATCH");
  });

  it("deleteSchedules: DELETE /api/schedules with { ids: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null));
    await deleteSchedules(["s1", "s2"]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/schedules");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ ids: ["s1", "s2"] });
  });
});

// ---------------------------------------------------------------------------
// Activity Log API
// ---------------------------------------------------------------------------

describe("fetchActivityLog", () => {
  it("GET /api/activity-log with entity_type, entity_id, limit, offset params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchActivityLog({ entity_type: "home_task", entity_id: "t1", limit: 20, offset: 5 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/activity-log?");
    expect(url).toContain("entity_type=home_task");
    expect(url).toContain("entity_id=t1");
    expect(url).toContain("limit=20");
    expect(url).toContain("offset=5");
  });

  it("calls /api/activity-log with no params when omitted", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchActivityLog();
    expect(mockFetch.mock.calls[0][0]).toBe("/api/activity-log");
  });
});
