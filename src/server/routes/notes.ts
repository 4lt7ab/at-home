import { Hono } from "hono";
import type {
  INoteService,
  CreateNoteInput,
  UpdateNoteInput,
} from "../../domain";

export function noteRoutes(service: INoteService): Hono {
  const app = new Hono();

  // GET /api/notes
  app.get("/", async (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const title = c.req.query("title");
    const filter: { title?: string; limit: number; offset: number } = { limit, offset };
    if (title) filter.title = title;
    return c.json(await service.list(filter));
  });

  // POST /api/notes
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateNoteInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const notes = await service.create(body.items);
    return c.json(notes, 201);
  });

  // GET /api/notes/:id
  app.get("/:id", async (c) => {
    return c.json(await service.get(c.req.param("id")));
  });

  // PATCH /api/notes
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateNoteInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const notes = await service.update(body.items);
    return c.json(notes);
  });

  // DELETE /api/notes
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    await service.remove(body.ids);
    return c.body(null, 204);
  });

  return app;
}
