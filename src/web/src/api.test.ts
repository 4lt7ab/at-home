import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  apiFetch,
  fetchNotes,
  fetchNote,
  createNotes,
  updateNotes,
  deleteNotes,
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

describe("query string building (via fetchNotes)", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
  });

  it("sends no query string when params omitted", async () => {
    await fetchNotes();
    expect(mockFetch).toHaveBeenCalledWith("/api/notes", undefined);
  });

  it("builds query string from string params", async () => {
    await fetchNotes({ title: "test" });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("title=test");
  });

  it("skips null and undefined values", async () => {
    await fetchNotes({ title: undefined });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toBe("/api/notes");
  });

  it("coerces numbers to strings", async () => {
    await fetchNotes({ limit: 10, offset: 0 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=0");
  });
});

// ---------------------------------------------------------------------------
// Entity CRUD — Notes
// ---------------------------------------------------------------------------

describe("Notes API", () => {
  it("fetchNotes: GET /api/notes with query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await fetchNotes({ title: "test", limit: 10 });
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/notes?");
    expect(url).toContain("title=test");
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

  it("createNotes: includes context when provided", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "n1" }]));
    await createNotes([{ title: "My Note", context: "some context" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.items[0].context).toBe("some context");
  });

  it("updateNotes: PATCH /api/notes with { items: [...] }", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "n1" }]));
    await updateNotes([{ id: "n1", title: "Updated" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/notes");
    expect(init.method).toBe("PATCH");
  });

  it("updateNotes: includes context field", async () => {
    mockFetch.mockResolvedValue(jsonResponse([{ id: "n1" }]));
    await updateNotes([{ id: "n1", context: "updated context" }]);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.items[0].context).toBe("updated context");
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
