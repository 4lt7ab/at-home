import { Hono } from "hono";
import type { AppContext } from "../../domain/bootstrap";
import { buildDailySummary } from "../../domain/summary";
import { completeTask } from "../../domain/operations/complete-task";

export function summaryRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  // GET /api/summary
  app.get("/", async (c) => {
    const dateParam = c.req.query("date");
    const lookaheadParam = c.req.query("lookahead_days");

    const now = new Date();
    const date = dateParam ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const rawLookahead = parseInt(lookaheadParam ?? "", 10);
    const lookaheadDays = Number.isFinite(rawLookahead) && rawLookahead >= 0
      ? Math.min(rawLookahead, 90)
      : 7;

    const summary = await buildDailySummary(date, lookaheadDays, ctx.scheduleRepo, ctx.homeTaskRepo, ctx.noteRepo);
    return c.json(summary);
  });

  // POST /api/summary/complete
  app.post("/complete", async (c) => {
    const body = await c.req.json<{ task_id: string; note?: string }>();
    if (!body.task_id || typeof body.task_id !== "string") {
      return c.json({ error: "task_id is required" }, 400);
    }

    const result = await completeTask(ctx.sql, ctx, { task_id: body.task_id, note: body.note });
    return c.json(result);
  });

  return app;
}
