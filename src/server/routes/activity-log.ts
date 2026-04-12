import { Hono } from "hono";
import type { ActivityLogRepository } from "../../domain/repositories/activity-log";

export function activityLogRoutes(repo: ActivityLogRepository): Hono {
  const app = new Hono();

  // GET /api/activity-log
  app.get("/", async (c) => {
    const entity_type = c.req.query("entity_type");
    const entity_id = c.req.query("entity_id");
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const filter = { entity_type, entity_id, limit, offset } as {
      entity_type?: string;
      entity_id?: string;
      limit: number;
      offset: number;
    };

    const [data, total] = await Promise.all([
      repo.findMany(filter),
      repo.count(filter),
    ]);

    return c.json({ data, total });
  });

  return app;
}
