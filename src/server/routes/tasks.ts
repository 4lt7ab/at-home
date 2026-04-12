import { Hono } from "hono";
import type {
  IHomeTaskService,
  CreateHomeTaskInput,
  UpdateHomeTaskInput,
} from "../../domain";
import { TASK_STATUSES, AREAS, EFFORT_LEVELS } from "../../domain";

export function taskRoutes(service: IHomeTaskService): Hono {
  const app = new Hono();

  // GET /api/tasks
  app.get("/", async (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const status = c.req.query("status");
    const area = c.req.query("area");
    const effort = c.req.query("effort");
    const title = c.req.query("title");

    if (status) {
      const statuses = status.split(",");
      for (const s of statuses) {
        if (!(TASK_STATUSES as readonly string[]).includes(s.trim())) {
          return c.json({ error: `invalid status '${s.trim()}'. Must be one of: ${TASK_STATUSES.join(", ")}` }, 400);
        }
      }
    }
    if (area && !(AREAS as readonly string[]).includes(area)) {
      return c.json({ error: `area must be one of: ${AREAS.join(", ")}` }, 400);
    }
    if (effort && !(EFFORT_LEVELS as readonly string[]).includes(effort)) {
      return c.json({ error: `effort must be one of: ${EFFORT_LEVELS.join(", ")}` }, 400);
    }

    const filter: { status?: string; area?: string; effort?: string; title?: string; limit: number; offset: number } = { limit, offset };
    if (status) filter.status = status;
    if (area) filter.area = area;
    if (effort) filter.effort = effort;
    if (title) filter.title = title;
    return c.json(await service.list(filter));
  });

  // POST /api/tasks
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateHomeTaskInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const tasks = await service.create(body.items);
    return c.json(tasks, 201);
  });

  // GET /api/tasks/:id
  app.get("/:id", async (c) => {
    return c.json(await service.get(c.req.param("id")));
  });

  // PATCH /api/tasks
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateHomeTaskInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const tasks = await service.update(body.items);
    return c.json(tasks);
  });

  // DELETE /api/tasks
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    await service.remove(body.ids);
    return c.body(null, 204);
  });

  return app;
}
