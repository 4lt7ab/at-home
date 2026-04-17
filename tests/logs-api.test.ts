import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Hono } from "hono";
import { bootstrap, type AppContext } from "../src/domain/bootstrap";
import { ServiceError } from "../src/domain/errors";
import { logRoutes } from "../src/server/routes/logs";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;
let app: Hono;

async function json(path: string, init?: RequestInit) {
  const r = await app.request(path, init);
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
}

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;

  app = new Hono();
  app.onError((err, c) => {
    if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
    if (err instanceof ServiceError) return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    return c.json({ error: "internal server error" }, 500);
  });
  app.route("/api/logs", logRoutes(ctx.logService, ctx.logEntryService));
});

afterAll(async () => {
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;
  await ctx.sql.end();
});

beforeEach(async () => {
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;
});

// ---------------------------------------------------------------------------
// POST /api/logs
// ---------------------------------------------------------------------------
describe("POST /api/logs", () => {
  test("creates a log", async () => {
    const { status, body } = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Plant watering" }] }),
    });
    expect(status).toBe(201);
    expect(body.data).toBeArrayOfSize(1);
    expect(body.data[0].name).toBe("Plant watering");
    expect(body.data[0].id).toBeDefined();
  });

  test("returns 400 when items is missing", async () => {
    const { status, body } = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "orphan" }),
    });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  test("returns 400 on empty name", async () => {
    const { status } = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "   " }] }),
    });
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs
// ---------------------------------------------------------------------------
describe("GET /api/logs", () => {
  test("lists with name filter, limit, offset, and projections", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Plant watering" }, { name: "Trash out" }] }),
    });
    const [plant] = create.body.data;

    // Add entries to plant
    await json(`/api/logs/${plant.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurred_at: "2026-01-01T00:00:00.000Z" }),
    });
    await json(`/api/logs/${plant.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurred_at: "2026-02-01T00:00:00.000Z" }),
    });

    const { status, body } = await json("/api/logs");
    expect(status).toBe(200);
    expect(body.total).toBe(2);
    const plantSummary = body.data.find((l: any) => l.id === plant.id);
    expect(plantSummary.entry_count).toBe(2);
    expect(plantSummary.last_logged_at).toBe("2026-02-01T00:00:00.000Z");

    const filtered = (await json("/api/logs?name=plant")).body;
    expect(filtered.total).toBe(1);
    expect(filtered.data[0].name).toBe("Plant watering");
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:id
// ---------------------------------------------------------------------------
describe("GET /api/logs/:id", () => {
  test("returns a log by id", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Fetch me" }] }),
    });
    const id = create.body.data[0].id;
    const { status, body } = await json(`/api/logs/${id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(id);
    expect(body.name).toBe("Fetch me");
  });

  test("returns 404 for unknown id", async () => {
    const { status } = await json("/api/logs/missing");
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/logs
// ---------------------------------------------------------------------------
describe("PATCH /api/logs", () => {
  test("updates a log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Before" }] }),
    });
    const id = create.body.data[0].id;
    const { status, body } = await json("/api/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id, name: "After" }] }),
    });
    expect(status).toBe(200);
    expect(body.data[0].name).toBe("After");
  });

  test("returns 400 on malformed body", async () => {
    const { status } = await json("/api/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x", name: "y" }),
    });
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/logs (with cascade)
// ---------------------------------------------------------------------------
describe("DELETE /api/logs", () => {
  test("deletes a log and cascades to entries", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Parent" }] }),
    });
    const id = create.body.data[0].id;
    await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const beforeDelete = await json(`/api/logs/${id}/entries`);
    expect(beforeDelete.body.total).toBe(2);

    const { status, body } = await json("/api/logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    expect(status).toBe(200);
    expect(body.deleted).toBe(1);

    const gone = await json(`/api/logs/${id}`);
    expect(gone.status).toBe(404);

    // Entries gone too (cascade)
    const afterDelete = await json(`/api/logs/${id}/entries`);
    expect(afterDelete.body.total).toBe(0);
  });

  test("returns 400 on missing ids", async () => {
    const { status } = await json("/api/logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/logs/:log_id/entries (one-tap quick-log)
// ---------------------------------------------------------------------------
describe("POST /api/logs/:log_id/entries", () => {
  test("one-tap with empty body defaults occurred_at to now", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Tap" }] }),
    });
    const id = create.body.data[0].id;
    const before = new Date().toISOString();
    const { status, body } = await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    const after = new Date().toISOString();
    expect(status).toBe(201);
    expect(body.data[0].log_id).toBe(id);
    expect(body.data[0].occurred_at >= before).toBe(true);
    expect(body.data[0].occurred_at <= after).toBe(true);
  });

  test("one-tap with { } body also defaults to now", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Tap2" }] }),
    });
    const id = create.body.data[0].id;
    const { status, body } = await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(status).toBe(201);
    expect(body.data[0].log_id).toBe(id);
  });

  test("accepts note and metadata in single-entry shorthand", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Full" }] }),
    });
    const id = create.body.data[0].id;
    const { status, body } = await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occurred_at: "2026-04-01T12:00:00.000Z",
        note: "my note",
        metadata: { k: "v" },
      }),
    });
    expect(status).toBe(201);
    expect(body.data[0].note).toBe("my note");
    expect(body.data[0].metadata).toEqual({ k: "v" });
    expect(body.data[0].occurred_at).toBe("2026-04-01T12:00:00.000Z");
  });

  test("accepts items array", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Batch" }] }),
    });
    const id = create.body.data[0].id;
    const { status, body } = await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { occurred_at: "2026-01-01T00:00:00.000Z" },
          { occurred_at: "2026-02-01T00:00:00.000Z" },
        ],
      }),
    });
    expect(status).toBe(201);
    expect(body.data).toBeArrayOfSize(2);
  });

  test("returns 404 when log_id doesn't exist", async () => {
    const { status } = await json(`/api/logs/missing/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(status).toBe(404);
  });

  test("returns 400 on invalid occurred_at", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Bad" }] }),
    });
    const id = create.body.data[0].id;
    const { status } = await json(`/api/logs/${id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurred_at: "nope" }),
    });
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:log_id/entries
// ---------------------------------------------------------------------------
describe("GET /api/logs/:log_id/entries", () => {
  test("lists entries ordered by occurred_at DESC, filtered by date range", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Hist" }] }),
    });
    const id = create.body.data[0].id;
    for (const ts of ["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"]) {
      await json(`/api/logs/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurred_at: ts }),
      });
    }

    const { body } = await json(`/api/logs/${id}/entries`);
    expect(body.total).toBe(3);
    expect(body.data[0].occurred_at).toBe("2026-12-01T00:00:00.000Z");

    const from = encodeURIComponent("2026-03-01T00:00:00.000Z");
    const to = encodeURIComponent("2026-09-01T00:00:00.000Z");
    const filtered = (await json(`/api/logs/${id}/entries?occurred_at_from=${from}&occurred_at_to=${to}`)).body;
    expect(filtered.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:log_id/entries/:entry_id
// ---------------------------------------------------------------------------
describe("GET /api/logs/:log_id/entries/:entry_id", () => {
  test("returns single entry", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "E" }] }),
    });
    const logId = create.body.data[0].id;
    const e = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "hi" }),
    });
    const entryId = e.body.data[0].id;
    const { status, body } = await json(`/api/logs/${logId}/entries/${entryId}`);
    expect(status).toBe(200);
    expect(body.id).toBe(entryId);
    expect(body.note).toBe("hi");
  });

  test("returns 404 for unknown entry", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "E2" }] }),
    });
    const logId = create.body.data[0].id;
    const { status } = await json(`/api/logs/${logId}/entries/missing`);
    expect(status).toBe(404);
  });

  test("returns 404 when entry belongs to a different log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "LogA" }, { name: "LogB" }] }),
    });
    const logA = create.body.data[0].id;
    const logB = create.body.data[1].id;
    const e = await json(`/api/logs/${logA}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const entryId = e.body.data[0].id;
    const { status } = await json(`/api/logs/${logB}/entries/${entryId}`);
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/logs/:log_id/entries/:entry_id — single-entry update
// ---------------------------------------------------------------------------
describe("PATCH /api/logs/:log_id/entries/:entry_id", () => {
  test("updates an entry and returns the single object", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "U" }] }),
    });
    const logId = create.body.data[0].id;
    const e = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "before" }),
    });
    const entryId = e.body.data[0].id;

    const { status, body } = await json(`/api/logs/${logId}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "after" }),
    });
    expect(status).toBe(200);
    expect(body.id).toBe(entryId);
    expect(body.note).toBe("after");
  });

  test("returns 404 when entry belongs to a different log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "LogA" }, { name: "LogB" }] }),
    });
    const logA = create.body.data[0].id;
    const logB = create.body.data[1].id;
    const e = await json(`/api/logs/${logA}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const entryId = e.body.data[0].id;

    const { status } = await json(`/api/logs/${logB}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "nope" }),
    });
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/logs/:log_id/entries/:entry_id — single-entry delete, 204
// ---------------------------------------------------------------------------
describe("DELETE /api/logs/:log_id/entries/:entry_id", () => {
  test("deletes an entry and returns 204", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "D" }] }),
    });
    const logId = create.body.data[0].id;
    const e = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const entryId = e.body.data[0].id;

    const { status, body } = await json(`/api/logs/${logId}/entries/${entryId}`, {
      method: "DELETE",
    });
    expect(status).toBe(204);
    expect(body).toBeNull();

    // Gone
    const gone = await json(`/api/logs/${logId}/entries/${entryId}`);
    expect(gone.status).toBe(404);
  });

  test("returns 404 when entry belongs to a different log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "LogA" }, { name: "LogB" }] }),
    });
    const logA = create.body.data[0].id;
    const logB = create.body.data[1].id;
    const e = await json(`/api/logs/${logA}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const entryId = e.body.data[0].id;
    const { status } = await json(`/api/logs/${logB}/entries/${entryId}`, {
      method: "DELETE",
    });
    expect(status).toBe(404);
    // Entry still exists under its real parent
    const still = await json(`/api/logs/${logA}/entries/${entryId}`);
    expect(still.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/logs/:log_id/entries — batch update scoped to log
// ---------------------------------------------------------------------------
describe("PATCH /api/logs/:log_id/entries (batch)", () => {
  test("updates entries when all belong to the log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Batch" }] }),
    });
    const logId = create.body.data[0].id;
    const e1 = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "a" }),
    });
    const e2 = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "b" }),
    });

    const { status, body } = await json(`/api/logs/${logId}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { id: e1.body.data[0].id, note: "A!" },
          { id: e2.body.data[0].id, note: "B!" },
        ],
      }),
    });

    expect(status).toBe(200);
    expect(body.data).toBeArrayOfSize(2);
    expect(body.data.map((e: any) => e.note).sort()).toEqual(["A!", "B!"]);
  });

  test("returns 404 when any id belongs to another log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "LogA" }, { name: "LogB" }] }),
    });
    const logA = create.body.data[0].id;
    const logB = create.body.data[1].id;
    const eA = await json(`/api/logs/${logA}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const eB = await json(`/api/logs/${logB}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const { status } = await json(`/api/logs/${logA}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { id: eA.body.data[0].id, note: "fine" },
          { id: eB.body.data[0].id, note: "wrong log" },
        ],
      }),
    });
    expect(status).toBe(404);
  });

  test("returns 400 on missing items", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "NoItems" }] }),
    });
    const logId = create.body.data[0].id;
    const { status } = await json(`/api/logs/${logId}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/logs/:log_id/entries — batch delete scoped to log
// ---------------------------------------------------------------------------
describe("DELETE /api/logs/:log_id/entries (batch)", () => {
  test("deletes entries by ids scoped to log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "Del" }] }),
    });
    const logId = create.body.data[0].id;
    const e1 = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const e2 = await json(`/api/logs/${logId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const ids = [e1.body.data[0].id, e2.body.data[0].id];

    const { status, body } = await json(`/api/logs/${logId}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    expect(status).toBe(200);
    expect(body.deleted).toBe(2);
  });

  test("returns 404 when any id belongs to another log", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "DA" }, { name: "DB" }] }),
    });
    const logA = create.body.data[0].id;
    const logB = create.body.data[1].id;
    const eA = await json(`/api/logs/${logA}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const eB = await json(`/api/logs/${logB}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const { status } = await json(`/api/logs/${logA}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [eA.body.data[0].id, eB.body.data[0].id] }),
    });
    expect(status).toBe(404);
    // Nothing should have been deleted under logA either
    const stillA = await json(`/api/logs/${logA}/entries`);
    expect(stillA.body.total).toBe(1);
  });

  test("returns 400 on missing ids", async () => {
    const create = await json("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: "NoIds" }] }),
    });
    const logId = create.body.data[0].id;
    const { status } = await json(`/api/logs/${logId}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });
});
