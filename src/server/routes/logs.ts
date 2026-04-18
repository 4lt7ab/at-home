import { Hono } from "hono";
import { z } from "zod";
import {
  ServiceError,
  type ILogService,
  type ILogEntryService,
  type CreateLogInput,
  type UpdateLogInput,
  type CreateLogEntryInput,
  type UpdateLogEntryInput,
} from "../../domain";
import { PALETTE, PALETTE_SET } from "../../domain/services/log-entries";

// Body schema for POST reactions — emoji must be one of the canonical PALETTE
// entries. PALETTE_SET is the single source of truth.
const reactionBodySchema = z.object({
  emoji: z.string().refine((e) => PALETTE_SET.has(e), {
    message: `emoji must be one of: ${PALETTE.join(", ")}`,
  }),
});

export function logRoutes(logService: ILogService, logEntryService: ILogEntryService): Hono {
  const app = new Hono();

  // -- Logs ------------------------------------------------------------------

  // GET /api/logs
  app.get("/", async (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const name = c.req.query("name");
    const filter: { name?: string; limit: number; offset: number } = { limit, offset };
    if (name) filter.name = name;
    return c.json(await logService.list(filter));
  });

  // POST /api/logs
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateLogInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const logs = await logService.create(body.items);
    return c.json({ data: logs }, 201);
  });

  // PATCH /api/logs
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateLogInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const logs = await logService.update(body.items);
    return c.json({ data: logs });
  });

  // DELETE /api/logs
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    const deleted = await logService.remove(body.ids);
    return c.json({ deleted });
  });

  // -- Log entries (nested under /:log_id/entries) ---------------------------

  // GET /api/logs/:log_id/entries
  app.get("/:log_id/entries", async (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const occurred_at_from = c.req.query("occurred_at_from");
    const occurred_at_to = c.req.query("occurred_at_to");
    const filter: {
      log_id: string;
      occurred_at_from?: string;
      occurred_at_to?: string;
      limit: number;
      offset: number;
    } = { log_id: c.req.param("log_id"), limit, offset };
    if (occurred_at_from) filter.occurred_at_from = occurred_at_from;
    if (occurred_at_to) filter.occurred_at_to = occurred_at_to;
    return c.json(await logEntryService.list(filter));
  });

  // POST /api/logs/:log_id/entries — accepts { items: [...] } or a single-entry body
  app.post("/:log_id/entries", async (c) => {
    const log_id = c.req.param("log_id");
    // Parse body; empty body is allowed for the one-tap case.
    let body: unknown = {};
    const raw = await c.req.text();
    if (raw.trim().length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        return c.json({ error: "invalid JSON body" }, 400);
      }
    }

    const b = body as { items?: CreateLogEntryInput[]; occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null };
    let items: CreateLogEntryInput[];
    if (Array.isArray(b.items)) {
      items = b.items.map((item) => ({ ...item, log_id }));
    } else {
      // Single-entry shorthand: body is { occurred_at?, note?, metadata? } (or empty)
      items = [{
        log_id,
        occurred_at: b.occurred_at,
        note: b.note ?? null,
        metadata: b.metadata ?? null,
      }];
    }

    const entries = await logEntryService.create(items);
    return c.json({ data: entries }, 201);
  });

  // PATCH /api/logs/:log_id/entries — batch update entries scoped to this log
  app.patch("/:log_id/entries", async (c) => {
    const log_id = c.req.param("log_id");
    const body = await c.req.json<{ items: UpdateLogEntryInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);

    // Every id in the batch must belong to this log. Cross-log mismatch → 404.
    for (const item of body.items) {
      const existing = await logEntryService.get(item.id).catch(() => null);
      if (!existing || existing.log_id !== log_id) {
        throw new ServiceError(`log entry not found under this log: ${item.id}`, 404);
      }
    }

    const entries = await logEntryService.update(body.items);
    return c.json({ data: entries });
  });

  // DELETE /api/logs/:log_id/entries — batch delete entries scoped to this log
  app.delete("/:log_id/entries", async (c) => {
    const log_id = c.req.param("log_id");
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);

    for (const id of body.ids) {
      const existing = await logEntryService.get(id).catch(() => null);
      if (!existing || existing.log_id !== log_id) {
        throw new ServiceError(`log entry not found under this log: ${id}`, 404);
      }
    }

    const deleted = await logEntryService.remove(body.ids);
    return c.json({ deleted });
  });

  // GET /api/logs/:log_id/entries/:entry_id
  app.get("/:log_id/entries/:entry_id", async (c) => {
    const log_id = c.req.param("log_id");
    const entry_id = c.req.param("entry_id");
    const entry = await logEntryService.get(entry_id);
    if (entry.log_id !== log_id) {
      throw new ServiceError("log entry not found under this log", 404);
    }
    return c.json(entry);
  });

  // PATCH /api/logs/:log_id/entries/:entry_id — body is the fields to change
  app.patch("/:log_id/entries/:entry_id", async (c) => {
    const log_id = c.req.param("log_id");
    const entry_id = c.req.param("entry_id");
    const existing = await logEntryService.get(entry_id);
    if (existing.log_id !== log_id) {
      throw new ServiceError("log entry not found under this log", 404);
    }
    const body = await c.req.json<Omit<UpdateLogEntryInput, "id">>();
    const [entry] = await logEntryService.update([{ id: entry_id, ...body }]);
    return c.json(entry);
  });

  // DELETE /api/logs/:log_id/entries/:entry_id — no body, returns 204
  app.delete("/:log_id/entries/:entry_id", async (c) => {
    const log_id = c.req.param("log_id");
    const entry_id = c.req.param("entry_id");
    const existing = await logEntryService.get(entry_id);
    if (existing.log_id !== log_id) {
      throw new ServiceError("log entry not found under this log", 404);
    }
    await logEntryService.remove([entry_id]);
    return c.body(null, 204);
  });

  // POST /api/logs/:log_id/entries/:entry_id/reactions — increment reaction count.
  // Never decrements (no DELETE companion). Body { emoji } is validated against
  // PALETTE; parent log mismatch returns 404. Returns the updated LogEntrySummary
  // so the client sees the fresh reactions projection in one hop. applyReaction
  // emits the log_entry DomainEvent internally — we do not emit here.
  app.post("/:log_id/entries/:entry_id/reactions", async (c) => {
    const log_id = c.req.param("log_id");
    const entry_id = c.req.param("entry_id");

    const existing = await logEntryService.get(entry_id);
    if (existing.log_id !== log_id) {
      throw new ServiceError("log entry not found under this log", 404);
    }

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const parsed = reactionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, 400);
    }

    await logEntryService.applyReaction(entry_id, parsed.data.emoji);
    const summary = await logEntryService.getSummary(entry_id);
    return c.json(summary);
  });

  // GET /api/logs/:id  (specific-log fetch; registered after /:log_id/entries so the matcher prefers the nested route)
  app.get("/:id", async (c) => {
    return c.json(await logService.get(c.req.param("id")));
  });

  return app;
}
