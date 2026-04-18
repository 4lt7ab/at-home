import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { bootstrap, type AppContext } from "../src/domain/bootstrap";
import { ServiceError } from "../src/domain/errors";
import { reminderRoutes } from "../src/server/routes/reminders";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Reminder } from "../src/domain/entities";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;
let app: Hono;

// -- Helpers ----------------------------------------------------------------

async function json(path: string, init?: RequestInit) {
  const r = await app.request(path, init);
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
}

function futureISO(hoursFromNow: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hoursFromNow);
  return d.toISOString();
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  await ctx.sql`DELETE FROM reminders`;

  app = new Hono();

  app.onError((err, c) => {
    if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
    if (err instanceof ServiceError) return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    return c.json({ error: "internal server error" }, 500);
  });

  app.route("/api/reminders", reminderRoutes(ctx.reminderService));
});

afterAll(async () => {
  await ctx.sql`DELETE FROM reminders`;
  await ctx.sql.end();
});

// ---------------------------------------------------------------------------
// POST /api/reminders
// ---------------------------------------------------------------------------
describe("POST /api/reminders", () => {
  test("creates a single reminder", async () => {
    const remindAt = futureISO(24);
    const { status, body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "Buy groceries", remind_at: remindAt }],
      }),
    });

    expect(status).toBe(201);
    expect(body.data).toBeArrayOfSize(1);
    expect(body.data[0].context).toBe("Buy groceries");
    expect(body.data[0].remind_at).toBeDefined();
    expect(body.data[0].id).toBeDefined();
    expect(body.data[0].recurrence).toBeNull();
    expect(body.data[0].dismissed_at).toBeNull();
  });

  test("creates multiple reminders in one request", async () => {
    const { status, body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { context: "Batch reminder A", remind_at: futureISO(1) },
          { context: "Batch reminder B", remind_at: futureISO(2), recurrence: "weekly" },
          { context: "Batch reminder C", remind_at: futureISO(3) },
        ],
      }),
    });

    expect(status).toBe(201);
    expect(body.data).toBeArrayOfSize(3);
    expect(body.data[1].recurrence).toBe("weekly");
    expect(body.data[0].recurrence).toBeNull();
  });

  test("returns 400 when required fields are missing", async () => {
    const { status, body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ context: "no remind_at" }] }),
    });

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  test("returns 400 when items array is missing", async () => {
    const { status, body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "orphan" }),
    });

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/reminders
// ---------------------------------------------------------------------------
describe("GET /api/reminders", () => {
  beforeAll(async () => {
    // Seed a known set of reminders for list tests
    await ctx.sql`DELETE FROM reminders`;
    const now = new Date();
    await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { context: "Morning standup", remind_at: new Date(now.getTime() + 1 * 3600000).toISOString(), recurrence: "weekly" },
          { context: "Weekly review", remind_at: new Date(now.getTime() + 2 * 3600000).toISOString(), recurrence: "weekly" },
          { context: "Dentist appointment", remind_at: new Date(now.getTime() + 48 * 3600000).toISOString() },
          { context: "Team lunch", remind_at: new Date(now.getTime() + 72 * 3600000).toISOString() },
          { context: "Buy birthday gift", remind_at: new Date(now.getTime() + 96 * 3600000).toISOString() },
        ],
      }),
    });
  });

  test("returns all reminders with no filters", async () => {
    const { status, body } = await json("/api/reminders");

    expect(status).toBe(200);
    expect(body.data).toBeArray();
    expect(body.total).toBe(5);
  });

  test("filters by context search", async () => {
    const { status, body } = await json("/api/reminders?context=standup");

    expect(status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].context).toContain("standup");
  });

  test("filters by date range", async () => {
    const now = new Date();
    const from = new Date(now.getTime() + 40 * 3600000).toISOString();
    const to = new Date(now.getTime() + 100 * 3600000).toISOString();

    const { status, body } = await json(
      `/api/reminders?remind_at_from=${encodeURIComponent(from)}&remind_at_to=${encodeURIComponent(to)}`
    );

    expect(status).toBe(200);
    // Should include Dentist (48h), Team lunch (72h), Buy birthday gift (96h)
    expect(body.data.length).toBe(3);
  });

  test("filters by status active", async () => {
    const { status, body } = await json("/api/reminders?status=active");

    expect(status).toBe(200);
    // All 5 are active (none dismissed)
    expect(body.total).toBe(5);
  });

  test("filters by status dormant", async () => {
    const { status, body } = await json("/api/reminders?status=dormant");

    expect(status).toBe(200);
    expect(body.total).toBe(0);
  });

  test("respects limit and offset", async () => {
    const page1 = (await json("/api/reminders?limit=2&offset=0")).body;
    const page2 = (await json("/api/reminders?limit=2&offset=2")).body;

    expect(page1.data).toBeArrayOfSize(2);
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    const ids1 = page1.data.map((r: any) => r.id);
    const ids2 = page2.data.map((r: any) => r.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toBeEmpty();
  });
});

// ---------------------------------------------------------------------------
// GET /api/reminders/:id
// ---------------------------------------------------------------------------
describe("GET /api/reminders/:id", () => {
  let reminderId: string;

  beforeAll(async () => {
    const { body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "Fetch me reminder", remind_at: futureISO(24) }],
      }),
    });
    reminderId = body.data[0].id;
  });

  test("returns 200 with full reminder", async () => {
    const { status, body } = await json(`/api/reminders/${reminderId}`);

    expect(status).toBe(200);
    expect(body.id).toBe(reminderId);
    expect(body.context).toBe("Fetch me reminder");
    expect(body.remind_at).toBeDefined();
    expect(body.created_at).toBeDefined();
  });

  test("returns 404 for non-existent id", async () => {
    const { status } = await json("/api/reminders/nonexistent");
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reminders
// ---------------------------------------------------------------------------
describe("PATCH /api/reminders", () => {
  let reminderId: string;

  beforeAll(async () => {
    const { body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "Patch me reminder", remind_at: futureISO(24) }],
      }),
    });
    reminderId = body.data[0].id;
  });

  test("updates fields successfully", async () => {
    const newRemindAt = futureISO(48);
    const { status, body } = await json("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: reminderId, context: "Updated context", recurrence: "monthly" }],
      }),
    });

    expect(status).toBe(200);
    expect(body.data[0].context).toBe("Updated context");
    expect(body.data[0].recurrence).toBe("monthly");
  });

  test("returns 400 for invalid input", async () => {
    const { status, body } = await json("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reminderId, context: "wrong shape" }),
    });

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reminders
// ---------------------------------------------------------------------------
describe("DELETE /api/reminders", () => {
  let reminderIds: string[];

  beforeAll(async () => {
    const { body } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { context: "Delete A", remind_at: futureISO(1) },
          { context: "Delete B", remind_at: futureISO(2) },
        ],
      }),
    });
    reminderIds = body.data.map((r: Reminder) => r.id);
  });

  test("deletes existing ids and returns deleted count", async () => {
    const { status, body } = await json("/api/reminders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reminderIds }),
    });

    expect(status).toBe(200);
    expect(body.deleted).toBe(2);

    // Verify they are gone
    for (const id of reminderIds) {
      const { status } = await json(`/api/reminders/${id}`);
      expect(status).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/reminders/dismiss
// ---------------------------------------------------------------------------
describe("POST /api/reminders/dismiss", () => {
  test("non-recurring reminder is deleted", async () => {
    // Create a non-recurring reminder
    const remindAt = futureISO(-1); // in the past so dismissed_at >= remind_at
    const { body: createBody } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "One-off reminder", remind_at: remindAt }],
      }),
    });
    const id = createBody.data[0].id;

    // Dismiss it
    const { status, body } = await json("/api/reminders/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id }] }),
    });

    expect(status).toBe(200);
    // Response still returns the final snapshot with dismissed_at set.
    expect(body.data[0].id).toBe(id);
    expect(body.data[0].dismissed_at).not.toBeNull();

    // But the reminder is gone.
    const { status: getStatus } = await json(`/api/reminders/${id}`);
    expect(getStatus).toBe(404);
  });

  test("recurring reminder advances remind_at", async () => {
    const remindAt = "2026-06-01T10:00:00.000Z";
    const { body: createBody } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "Weekly standup", remind_at: remindAt, recurrence: "weekly" }],
      }),
    });
    const id = createBody.data[0].id;

    const { status, body } = await json("/api/reminders/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id }] }),
    });

    expect(status).toBe(200);
    expect(body.data[0].dismissed_at).not.toBeNull();
    // remind_at should have advanced by 7 days (weekly)
    expect(body.data[0].remind_at).toBe("2026-06-08T10:00:00.000Z");
  });

  test("dismiss with override remind_at", async () => {
    const { body: createBody } = await json("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ context: "Flexible reminder", remind_at: futureISO(24) }],
      }),
    });
    const id = createBody.data[0].id;
    const overrideRemindAt = "2026-12-25T09:00:00.000Z";

    const { status, body } = await json("/api/reminders/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id, remind_at: overrideRemindAt }] }),
    });

    expect(status).toBe(200);
    expect(body.data[0].remind_at).toBe(overrideRemindAt);
    expect(body.data[0].dismissed_at).not.toBeNull();
  });
});
