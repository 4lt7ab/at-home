import type { Note, NoteSummary } from "@domain/entities";

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
