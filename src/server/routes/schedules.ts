import { Hono } from "hono";
import type {
  IScheduleService,
  CreateScheduleInput,
  UpdateScheduleInput,
} from "../../domain";
import { RECURRENCE_TYPES } from "../../domain";

export function scheduleRoutes(service: IScheduleService): Hono {
  const app = new Hono();

  // GET /api/schedules
  app.get("/", (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const task_id = c.req.query("task_id");
    const recurrence_type = c.req.query("recurrence_type");

    // Validate enum query params
    if (recurrence_type && !(RECURRENCE_TYPES as readonly string[]).includes(recurrence_type)) {
      return c.json({ error: `recurrence_type must be one of: ${RECURRENCE_TYPES.join(", ")}` }, 400);
    }

    const filter: { task_id?: string; recurrence_type?: string; limit: number; offset: number } = { limit, offset };
    if (task_id) filter.task_id = task_id;
    if (recurrence_type) filter.recurrence_type = recurrence_type;
    return c.json(service.list(filter));
  });

  // POST /api/schedules
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateScheduleInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const schedules = service.create(body.items);
    return c.json(schedules, 201);
  });

  // GET /api/schedules/:id
  app.get("/:id", (c) => {
    return c.json(service.get(c.req.param("id")));
  });

  // PATCH /api/schedules
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateScheduleInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const schedules = service.update(body.items);
    return c.json(schedules);
  });

  // DELETE /api/schedules
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    service.remove(body.ids);
    return c.body(null, 204);
  });

  return app;
}
