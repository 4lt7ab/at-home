import type {
  Note,
  NoteSummary,
  Reminder,
  ReminderSummary,
  Log,
  LogSummary,
  LogEntry,
  LogEntrySummary,
} from "@domain/entities";

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
// Notes API
// ---------------------------------------------------------------------------

export async function fetchNotes(params?: {
  title?: string; limit?: number; offset?: number;
}): Promise<{ data: NoteSummary[]; total: number }> {
  const res = await apiFetch(`/api/notes${qs(params)}`);
  return res.json();
}

export async function fetchNote(id: string): Promise<Note> {
  const res = await apiFetch(`/api/notes/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createNotes(inputs: Array<{
  title: string; context?: string;
}>): Promise<Note[]> {
  const res = await apiFetch("/api/notes", jsonPost({ items: inputs }));
  return res.json();
}

export async function updateNotes(inputs: Array<{
  id: string; title?: string; context?: string | null;
}>): Promise<Note[]> {
  const res = await apiFetch("/api/notes", jsonPatch({ items: inputs }));
  return res.json();
}

export async function deleteNotes(ids: string[]): Promise<void> {
  await apiFetch("/api/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

// ---------------------------------------------------------------------------
// Reminders API
// ---------------------------------------------------------------------------

export async function fetchReminders(params?: {
  context?: string; remind_at_from?: string; remind_at_to?: string;
  status?: string; limit?: number; offset?: number;
}): Promise<{ data: ReminderSummary[]; total: number }> {
  const res = await apiFetch(`/api/reminders${qs(params)}`);
  return res.json();
}

export async function fetchReminder(id: string): Promise<Reminder> {
  const res = await apiFetch(`/api/reminders/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createReminders(items: Array<{
  context: string; remind_at: string; recurrence?: string;
}>): Promise<Reminder[]> {
  const res = await apiFetch("/api/reminders", jsonPost({ items }));
  return res.json();
}

export async function updateReminders(items: Array<{
  id: string; context?: string; remind_at?: string; recurrence?: string | null;
}>): Promise<Reminder[]> {
  const res = await apiFetch("/api/reminders", jsonPatch({ items }));
  return res.json();
}

export async function deleteReminders(ids: string[]): Promise<void> {
  await apiFetch("/api/reminders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

export async function dismissReminders(items: Array<{
  id: string; remind_at?: string;
}>): Promise<Reminder[]> {
  const res = await apiFetch("/api/reminders/dismiss", jsonPost({ items }));
  return res.json();
}

// ---------------------------------------------------------------------------
// Logs API
// ---------------------------------------------------------------------------

export async function fetchLogs(params?: {
  name?: string; limit?: number; offset?: number;
}): Promise<{ data: LogSummary[]; total: number }> {
  const res = await apiFetch(`/api/logs${qs(params)}`);
  return res.json();
}

export async function fetchLog(id: string): Promise<Log> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createLogs(items: Array<{
  name: string; description?: string | null;
}>): Promise<Log[]> {
  const res = await apiFetch("/api/logs", jsonPost({ items }));
  const body = await res.json();
  return body.data;
}

export async function updateLogs(items: Array<{
  id: string; name?: string; description?: string | null;
}>): Promise<Log[]> {
  const res = await apiFetch("/api/logs", jsonPatch({ items }));
  const body = await res.json();
  return body.data;
}

export async function deleteLogs(ids: string[]): Promise<void> {
  await apiFetch("/api/logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

export async function fetchLogEntries(logId: string, params?: {
  occurred_at_from?: string; occurred_at_to?: string; limit?: number; offset?: number;
}): Promise<{ data: LogEntrySummary[]; total: number }> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries${qs(params)}`);
  return res.json();
}

export async function fetchLogEntry(logId: string, entryId: string): Promise<LogEntry> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries/${encodeURIComponent(entryId)}`);
  return res.json();
}

/** One-tap quick-log helper. Body-less call defaults occurred_at to now on the server. */
export async function createLogEntry(logId: string, input?: {
  occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null;
}): Promise<LogEntry> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries`, jsonPost(input ?? {}));
  const body = await res.json();
  return body.data[0];
}

export async function createLogEntries(logId: string, items: Array<{
  occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null;
}>): Promise<LogEntry[]> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries`, jsonPost({ items }));
  const body = await res.json();
  return body.data;
}

/** Batch update entries scoped to a single log. Every id must belong to `logId` or the whole call 404s. */
export async function updateLogEntries(logId: string, items: Array<{
  id: string; occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null;
}>): Promise<LogEntry[]> {
  const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries`, jsonPatch({ items }));
  const body = await res.json();
  return body.data;
}

/** Update a single entry — uses the dedicated nested route. */
export async function updateLogEntry(logId: string, entryId: string, patch: {
  occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null;
}): Promise<LogEntry> {
  const res = await apiFetch(
    `/api/logs/${encodeURIComponent(logId)}/entries/${encodeURIComponent(entryId)}`,
    jsonPatch(patch),
  );
  return res.json();
}

/** Batch delete entries scoped to a single log. */
export async function deleteLogEntries(logId: string, ids: string[]): Promise<void> {
  await apiFetch(`/api/logs/${encodeURIComponent(logId)}/entries`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

/** Delete a single entry — uses the dedicated nested route, returns 204. */
export async function deleteLogEntry(logId: string, entryId: string): Promise<void> {
  await apiFetch(
    `/api/logs/${encodeURIComponent(logId)}/entries/${encodeURIComponent(entryId)}`,
    { method: "DELETE" },
  );
}

/**
 * Increment a reaction on a log entry. `emoji` must be one of the PALETTE
 * emojis (single source of truth with the backend); the server 400s otherwise.
 * Returns the updated LogEntrySummary with the fresh `reactions` projection.
 */
export async function addLogEntryReaction(
  logId: string,
  entryId: string,
  emoji: string,
): Promise<LogEntrySummary> {
  const res = await apiFetch(
    `/api/logs/${encodeURIComponent(logId)}/entries/${encodeURIComponent(entryId)}/reactions`,
    jsonPost({ emoji }),
  );
  return res.json();
}
