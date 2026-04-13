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

// -- Status reporting -------------------------------------------------------

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function report(method: string, path: string, status: number, expected: number) {
  const ok = status === expected;
  const icon = ok ? green("✓") : red("✗");
  const statusStr = ok ? green(String(status)) : red(String(status));
  console.log(`  ${icon} ${bold(method.padEnd(6))} ${path} ${dim("→")} ${statusStr}`);
}

// -- Helpers ----------------------------------------------------------------

async function json(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const r = await app.request(path, init);
  return { status: r.status, body: r.status === 204 ? null : await r.json(), method, path };
}

function expectStatus(res: { status: number; method: string; path: string }, expected: number) {
  report(res.method, res.path, res.status, expected);
  expect(res.status).toBe(expected);
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
  console.log(`\n${bold("API Integration Tests")} ${dim(`(${TEST_DB.replace(/\/\/.*@/, "//***@")})`)}\n`);
});

afterAll(async () => {
  await ctx.sql`DELETE FROM notes`;
  await ctx.sql.end();
});

// ---------------------------------------------------------------------------
// POST /api/notes
// ---------------------------------------------------------------------------
describe("POST /api/notes", () => {
  test("creates a single note", async () => {
    const res = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "API note", context: "hello" }] }),
    });

    expectStatus(res, 201);
    expect(res.body).toBeArrayOfSize(1);
    expect(res.body[0].title).toBe("API note");
    expect(res.body[0].context).toBe("hello");
    expect(res.body[0].id).toBeDefined();
    expect(res.body[0].created_at).toBeDefined();
  });

  test("creates multiple notes in one request", async () => {
    const res = await json("/api/notes", {
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

    expectStatus(res, 201);
    expect(res.body).toBeArrayOfSize(3);
    expect(res.body[1].context).toBe("with context");
    expect(res.body[0].context).toBeNull();
  });

  test("returns 400 when items is missing", async () => {
    const res = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "orphan" }),
    });

    expectStatus(res, 400);
    expect(res.body.error).toBeDefined();
  });

  test("returns 400 for blank title", async () => {
    const res = await json("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ title: "   " }] }),
    });

    expectStatus(res, 400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/notes
// ---------------------------------------------------------------------------
describe("GET /api/notes", () => {
  test("returns paginated list", async () => {
    const res = await json("/api/notes");

    expectStatus(res, 200);
    expect(res.body.data).toBeArray();
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data[0]).toHaveProperty("has_context");
    expect(res.body.data[0]).not.toHaveProperty("context");
  });

  test("respects limit and offset", async () => {
    const res1 = await json("/api/notes?limit=2&offset=0");
    const res2 = await json("/api/notes?limit=2&offset=2");

    expectStatus(res1, 200);
    expectStatus(res2, 200);
    expect(res1.body.data).toBeArrayOfSize(2);
    expect(res2.body.data.length).toBeGreaterThanOrEqual(1);
    const ids1 = res1.body.data.map((n: NoteSummary) => n.id);
    const ids2 = res2.body.data.map((n: NoteSummary) => n.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toBeEmpty();
  });

  test("filters by title substring", async () => {
    const res = await json("/api/notes?title=Batch");

    expectStatus(res, 200);
    expect(res.body.data.length).toBe(3);
    for (const n of res.body.data) {
      expect(n.title).toContain("Batch");
    }
  });

  test("handles invalid limit gracefully", async () => {
    const res = await json("/api/notes?limit=-5");
    expectStatus(res, 200);
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

  test("returns full note with context", async () => {
    const res = await json(`/api/notes/${noteId}`);

    expectStatus(res, 200);
    expect(res.body.id).toBe(noteId);
    expect(res.body.title).toBe("Fetch me");
    expect(res.body.context).toBe("detailed");
  });

  test("returns 404 for nonexistent id", async () => {
    const res = await json("/api/notes/nonexistent");
    expectStatus(res, 404);
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

  test("updates title", async () => {
    const res = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, title: "Patched title" }] }),
    });

    expectStatus(res, 200);
    expect(res.body[0].title).toBe("Patched title");
    expect(res.body[0].context).toBe("original");
  });

  test("updates context", async () => {
    const res = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, context: "new context" }] }),
    });

    expectStatus(res, 200);
    expect(res.body[0].context).toBe("new context");
  });

  test("nulls out context", async () => {
    const res = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: noteId, context: null }] }),
    });

    expectStatus(res, 200);
    expect(res.body[0].context).toBeNull();
  });

  test("returns 400 when items is missing", async () => {
    const res = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, title: "wrong shape" }),
    });

    expectStatus(res, 400);
  });

  test("returns 404 for nonexistent note", async () => {
    const res = await json("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "nope", title: "ghost" }] }),
    });

    expectStatus(res, 404);
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

  test("deletes notes and returns 204", async () => {
    const r = await app.request("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: noteIds }),
    });

    report("DELETE", "/api/notes", r.status, 204);
    expect(r.status).toBe(204);

    for (const id of noteIds) {
      const res = await json(`/api/notes/${id}`);
      expectStatus(res, 404);
    }
  });

  test("returns 400 when ids is missing", async () => {
    const res = await json("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: ["wrong-shape"] }),
    });

    expectStatus(res, 400);
  });

  test("empty ids array returns 204", async () => {
    const r = await app.request("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });

    report("DELETE", "/api/notes", r.status, 204);
    expect(r.status).toBe(204);
  });
});
