import type { Note, NoteSummary, Reminder, ReminderSummary } from "@domain/entities";

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
