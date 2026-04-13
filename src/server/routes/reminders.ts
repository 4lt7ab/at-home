import { Hono } from "hono";
import type {
  IReminderService,
  CreateReminderInput,
  UpdateReminderInput,
  DismissReminderInput,
} from "../../domain";

export function reminderRoutes(service: IReminderService): Hono {
  const app = new Hono();

  // GET /api/reminders
  app.get("/", async (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const context = c.req.query("context");
    const remind_at_from = c.req.query("remind_at_from");
    const remind_at_to = c.req.query("remind_at_to");
    const status = c.req.query("status") as "active" | "dormant" | undefined;
    const filter: {
      context?: string;
      remind_at_from?: string;
      remind_at_to?: string;
      status?: "active" | "dormant";
      limit: number;
      offset: number;
    } = { limit, offset };
    if (context) filter.context = context;
    if (remind_at_from) filter.remind_at_from = remind_at_from;
    if (remind_at_to) filter.remind_at_to = remind_at_to;
    if (status) filter.status = status;
    return c.json(await service.list(filter));
  });

  // POST /api/reminders
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateReminderInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const reminders = await service.create(body.items);
    return c.json({ data: reminders }, 201);
  });

  // GET /api/reminders/:id
  app.get("/:id", async (c) => {
    return c.json(await service.get(c.req.param("id")));
  });

  // PATCH /api/reminders
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateReminderInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const reminders = await service.update(body.items);
    return c.json({ data: reminders });
  });

  // DELETE /api/reminders
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    const deleted = await service.remove(body.ids);
    return c.json({ deleted });
  });

  // POST /api/reminders/dismiss
  app.post("/dismiss", async (c) => {
    const body = await c.req.json<{ items: DismissReminderInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const reminders = await Promise.all(body.items.map((item) => service.dismiss(item)));
    return c.json({ data: reminders });
  });

  return app;
}
