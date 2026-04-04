import { Hono } from "hono";
import type {
  INoteService,
  CreateNoteInput,
  UpdateNoteInput,
  NoteType,
} from "../../domain";
import { NOTE_TYPES } from "../../domain";

export function noteRoutes(service: INoteService): Hono {
  const app = new Hono();

  // GET /api/notes
  app.get("/", (c) => {
    const rawLimit = parseInt(c.req.query("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 50;
    const rawOffset = parseInt(c.req.query("offset") ?? "", 10);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const task_id = c.req.query("task_id");
    const title = c.req.query("title");
    const note_type = c.req.query("note_type");
    const filter: { task_id?: string; title?: string; note_type?: NoteType; limit: number; offset: number } = { limit, offset };
    if (task_id) filter.task_id = task_id;
    if (title) filter.title = title;
    if (note_type && (NOTE_TYPES as readonly string[]).includes(note_type)) {
      filter.note_type = note_type as NoteType;
    }
    return c.json(service.list(filter));
  });

  // POST /api/notes
  app.post("/", async (c) => {
    const body = await c.req.json<{ items: CreateNoteInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const notes = service.create(body.items);
    return c.json(notes, 201);
  });

  // GET /api/notes/:id
  app.get("/:id", (c) => {
    return c.json(service.get(c.req.param("id")));
  });

  // PATCH /api/notes
  app.patch("/", async (c) => {
    const body = await c.req.json<{ items: UpdateNoteInput[] }>();
    if (!Array.isArray(body.items)) return c.json({ error: "items array is required" }, 400);
    const notes = service.update(body.items);
    return c.json(notes);
  });

  // DELETE /api/notes
  app.delete("/", async (c) => {
    const body = await c.req.json<{ ids: string[] }>();
    if (!Array.isArray(body.ids)) return c.json({ error: "ids array is required" }, 400);
    service.remove(body.ids);
    return c.body(null, 204);
  });

  return app;
}
