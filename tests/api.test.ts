import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { bootstrap, type AppContext } from "../src/domain/bootstrap";
import { ServiceError } from "../src/domain/errors";
import { noteRoutes } from "../src/server/routes/notes";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Note, NoteSummary } from "../src/domain/entities";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;
let app: Hono;

// -- Helpers ----------------------------------------------------------------

async function json(path: string, init?: RequestInit) {
  const r = await app.request(path, init);
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  await ctx.sql`DELETE FROM notes`;

  app = new Hono();

  app.onError((err, c) => {
    if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
    if (err instanceof ServiceError) return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    return c.json({ error: "internal server error" }, 500);
  });

  app.route("/api/notes", noteRoutes(ctx.noteService));
});

afterAll(async () => {
  await ctx.sql`DELETE FROM notes`;
  await ctx.sql.end();
});

// ---------------------------------------------------------------------------
// POST /api/notes
// ---------------------------------------------------------------------------
describe("POST /api/notes", () => {
  test("→ 201 creates a single note", async () => {
    const { status, body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "API note", context: "hello" }] }),
    });

    expect(status).toBe(201);
    expect(body).toBeArrayOfSize(1);
    expect(body[0].title).toBe("API note");
    expect(body[0].context).toBe("hello");
    expect(body[0].id).toBeDefined();
    expect(body[0].created_at).toBeDefined();
  });

  test("→ 201 creates multiple notes in one request", async () => {
    const { status, body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { title: "Batch A" },
          { title: "Batch B", context: "with context" },
          { title: "Batch C" },
        ],
      }),
    });

    expect(status).toBe(201);
    expect(body).toBeArrayOfSize(3);
    expect(body[1].context).toBe("with context");
    expect(body[0].context).toBeNull();
  });

  test("→ 400 when items is missing", async () => {
    const { status, body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "orphan" }),
    });

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  test("→ 400 for blank title", async () => {
    const { status } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "   " }] }),
    });

    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes
// ---------------------------------------------------------------------------
describe("GET /api/notes", () => {
  test("→ 200 returns paginated list of summaries", async () => {
    const { status, body } = await json("/api/notes");

    expect(status).toBe(200);
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.data[0]).toHaveProperty("has_context");
    expect(body.data[0]).not.toHaveProperty("context");
  });

  test("→ 200 respects limit and offset", async () => {
    const page1 = (await json("/api/notes?limit=2&offset=0")).body;
    const page2 = (await json("/api/notes?limit=2&offset=2")).body;

    expect(page1.data).toBeArrayOfSize(2);
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    const ids1 = page1.data.map((n: NoteSummary) => n.id);
    const ids2 = page2.data.map((n: NoteSummary) => n.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toBeEmpty();
  });

  test("→ 200 filters by title substring", async () => {
    const { body } = await json("/api/notes?title=Batch");

    expect(body.data.length).toBe(3);
    for (const n of body.data) {
      expect(n.title).toContain("Batch");
    }
  });

  test("→ 200 handles invalid limit gracefully", async () => {
    const { status } = await json("/api/notes?limit=-5");
    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes/:id
// ---------------------------------------------------------------------------
describe("GET /api/notes/:id", () => {
  let noteId: string;

  beforeAll(async () => {
    const { body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "Fetch me", context: "detailed" }] }),
    });
    noteId = body[0].id;
  });

  test("→ 200 returns full note with context", async () => {
    const { status, body } = await json(`/api/notes/${noteId}`);

    expect(status).toBe(200);
    expect(body.id).toBe(noteId);
    expect(body.title).toBe("Fetch me");
    expect(body.context).toBe("detailed");
  });

  test("→ 404 for nonexistent id", async () => {
    const { status } = await json("/api/notes/nonexistent");
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/notes
// ---------------------------------------------------------------------------
describe("PATCH /api/notes", () => {
  let noteId: string;

  beforeAll(async () => {
    const { body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "Patch me", context: "original" }] }),
    });
    noteId = body[0].id;
  });

  test("→ 200 updates title", async () => {
    const { status, body } = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, title: "Patched title" }] }),
    });

    expect(status).toBe(200);
    expect(body[0].title).toBe("Patched title");
    expect(body[0].context).toBe("original");
  });

  test("→ 200 updates context", async () => {
    const { body } = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, context: "new context" }] }),
    });

    expect(body[0].context).toBe("new context");
  });

  test("→ 200 nulls out context", async () => {
    const { body } = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, context: null }] }),
    });

    expect(body[0].context).toBeNull();
  });

  test("→ 400 when items is missing", async () => {
    const { status } = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, title: "wrong shape" }),
    });

    expect(status).toBe(400);
  });

  test("→ 404 for nonexistent note", async () => {
    const { status } = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "nope", title: "ghost" }] }),
    });

    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/notes
// ---------------------------------------------------------------------------
describe("DELETE /api/notes", () => {
  let noteIds: string[];

  beforeAll(async () => {
    const { body } = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: "Delete A" }, { title: "Delete B" }],
      }),
    });
    noteIds = body.map((n: Note) => n.id);
  });

  test("→ 204 deletes notes (verified gone)", async () => {
    const res = await app.request("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: noteIds }),
    });

    expect(res.status).toBe(204);

    for (const id of noteIds) {
      const { status } = await json(`/api/notes/${id}`);
      expect(status).toBe(404);
    }
  });

  test("→ 400 when ids is missing", async () => {
    const { status } = await json("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: ["wrong-shape"] }),
    });

    expect(status).toBe(400);
  });

  test("→ 204 with empty ids array", async () => {
    const res = await app.request("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(204);
  });
});
