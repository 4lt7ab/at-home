import type {
  HomeTask, HomeTaskSummary, Note, NoteSummary,
  Schedule, ScheduleSummary, ActivityLog,
} from "@domain/entities";
import type { DailySummary } from "@domain/summary";

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError("Network error — is the server running?", 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as Record<string, unknown> | null)?.error ??
      `Request failed (${res.status})`;
    throw new ApiError(String(message), res.status);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function jsonPost(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function jsonPatch(body: unknown): RequestInit {
  return { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ---------------------------------------------------------------------------
// Daily Summary API
// ---------------------------------------------------------------------------

export async function fetchDailySummary(date?: string, lookahead?: number): Promise<DailySummary> {
  const res = await apiFetch(`/api/summary${qs({ date, lookahead_days: lookahead })}`);
  return res.json();
}

export async function completeTask(taskId: string, note?: string): Promise<{
  task: HomeTask;
  schedule: Schedule | null;
  next_due: string | null;
  completed_at: string;
  note_created: Note | null;
}> {
  const res = await apiFetch("/api/summary/complete", jsonPost({ task_id: taskId, note }));
  return res.json();
}

// ---------------------------------------------------------------------------
// Tasks API
// ---------------------------------------------------------------------------

export async function fetchTasks(params?: {
  status?: string; area?: string; effort?: string; title?: string;
  limit?: number; offset?: number;
}): Promise<{ data: HomeTaskSummary[]; total: number }> {
  const res = await apiFetch(`/api/tasks${qs(params)}`);
  return res.json();
}

export async function fetchTask(id: string): Promise<HomeTask> {
  const res = await apiFetch(`/api/tasks/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createTasks(inputs: Array<{
  title: string; description?: string; status?: string; area?: string; effort?: string;
}>): Promise<HomeTask[]> {
  const res = await apiFetch("/api/tasks", jsonPost({ items: inputs }));
  return res.json();
}

export async function updateTasks(inputs: Array<{
  id: string; title?: string; description?: string | null;
  status?: string; area?: string | null; effort?: string | null;
}>): Promise<HomeTask[]> {
  const res = await apiFetch("/api/tasks", jsonPatch({ items: inputs }));
  return res.json();
}

export async function deleteTasks(ids: string[]): Promise<void> {
  await apiFetch("/api/tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

// ---------------------------------------------------------------------------
// Notes API
// ---------------------------------------------------------------------------

export async function fetchNotes(params?: {
  task_id?: string; title?: string; note_type?: string; limit?: number; offset?: number;
}): Promise<{ data: NoteSummary[]; total: number }> {
  const res = await apiFetch(`/api/notes${qs(params)}`);
  return res.json();
}

export async function fetchNote(id: string): Promise<Note> {
  const res = await apiFetch(`/api/notes/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createNotes(inputs: Array<{
  title: string; content?: string; task_id?: string;
}>): Promise<Note[]> {
  const res = await apiFetch("/api/notes", jsonPost({ items: inputs }));
  return res.json();
}

export async function updateNotes(inputs: Array<{
  id: string; title?: string; content?: string | null; task_id?: string | null;
}>): Promise<Note[]> {
  const res = await apiFetch("/api/notes", jsonPatch({ items: inputs }));
  return res.json();
}

export async function deleteNotes(ids: string[]): Promise<void> {
  await apiFetch("/api/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

// ---------------------------------------------------------------------------
// Schedules API
// ---------------------------------------------------------------------------

export async function fetchSchedules(params?: {
  task_id?: string; recurrence_type?: string; limit?: number; offset?: number;
}): Promise<{ data: ScheduleSummary[]; total: number }> {
  const res = await apiFetch(`/api/schedules${qs(params)}`);
  return res.json();
}

export async function fetchSchedule(id: string): Promise<Schedule> {
  const res = await apiFetch(`/api/schedules/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createSchedules(inputs: Array<{
  task_id: string; recurrence_type: string; recurrence_rule?: string; next_due?: string;
}>): Promise<Schedule[]> {
  const res = await apiFetch("/api/schedules", jsonPost({ items: inputs }));
  return res.json();
}

export async function updateSchedules(inputs: Array<{
  id: string; recurrence_type?: string; recurrence_rule?: string | null; next_due?: string | null;
}>): Promise<Schedule[]> {
  const res = await apiFetch("/api/schedules", jsonPatch({ items: inputs }));
  return res.json();
}

export async function deleteSchedules(ids: string[]): Promise<void> {
  await apiFetch("/api/schedules", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

// ---------------------------------------------------------------------------
// Activity Log API
// ---------------------------------------------------------------------------

export async function fetchActivityLog(params?: {
  entity_type?: string; entity_id?: string; limit?: number; offset?: number;
}): Promise<{ data: ActivityLog[]; total: number }> {
  const res = await apiFetch(`/api/activity-log${qs(params)}`);
  return res.json();
}
