#!/usr/bin/env bun
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { etag } from "hono/etag";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { bootstrap, ServiceError } from "../domain";
import type { DomainEvent } from "../domain/events";
import { parseArgs, parseCorsOrigins, logListening, type ServerOptions } from "../domain/args";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { taskRoutes } from "./routes/tasks";
import { noteRoutes } from "./routes/notes";
import { scheduleRoutes } from "./routes/schedules";
import { activityLogRoutes } from "./routes/activity-log";
import { summaryRoutes } from "./routes/summary";
import { createMcpHttpHandler } from "../mcp/server";
import type { ServerWebSocket } from "bun";

export class Server {
  private options: ServerOptions;

  constructor(options?: Partial<ServerOptions>) {
    const defaults = parseArgs({ port: 3100, portEnv: "HOME_PORT" });
    this.options = { ...defaults, ...options };
  }

  async start(): Promise<void> {
    const startedAt = Date.now();
    const { port, host, dbPath } = this.options;
    const ctx = await bootstrap(dbPath);
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf-8")) as { version: string };
    const version = pkg.version;

    const app = new Hono();
    const isAllowedOrigin = parseCorsOrigins(process.env.HOME_CORS_ORIGINS);

    // -- Global middleware ------------------------------------------
    app.use("*", secureHeaders());
    app.use("*", compress());
    app.use("/api/*", bodyLimit({ maxSize: 1 * 1024 * 1024 }));
    app.use(
      "*",
      cors({
        origin: (origin) => (origin && isAllowedOrigin(origin)) ? origin : null,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
        exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
      })
    );

    // -- API (with logging) ----------------------------------------
    app.use("/api/*", logger((str) => process.stderr.write(str + "\n")));
    app.route("/api/tasks", taskRoutes(ctx.homeTaskService));
    app.route("/api/notes", noteRoutes(ctx.noteService));
    app.route("/api/schedules", scheduleRoutes(ctx.scheduleService));
    app.route("/api/activity-log", activityLogRoutes(ctx.activityLogRepo));
    app.route("/api/summary", summaryRoutes(ctx));
    app.get("/api/health", (c) => {
      let dbOk = false;
      try {
        const row = ctx.db.query("SELECT 1 AS ok").get() as { ok: number } | null;
        dbOk = row?.ok === 1;
      } catch {
        dbOk = false;
      }

      return c.json({
        status: dbOk ? "ok" : "degraded",
        version,
        uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
        database: dbOk ? "connected" : "unreachable",
        timestamp: new Date().toISOString(),
      });
    });

    // -- MCP --------------------------------------------------------
    app.use("/mcp", logger((str) => process.stderr.write(str + "\n")));
    const handleMcp = createMcpHttpHandler({
      db: ctx.db,
      eventBus: ctx.eventBus,
      homeTaskService: ctx.homeTaskService,
      noteService: ctx.noteService,
      scheduleService: ctx.scheduleService,
      homeTaskRepo: ctx.homeTaskRepo,
      noteRepo: ctx.noteRepo,
      scheduleRepo: ctx.scheduleRepo,
    });
    app.all("/mcp", (c) => handleMcp(c.req.raw));

    // -- Static web assets -----------------------------------------
    const dist = join(import.meta.dir, "../web/dist");
    const indexPath = join(dist, "index.html");
    const indexHtml = existsSync(indexPath)
      ? readFileSync(indexPath, "utf-8")
      : null;

    app.use(
      "/assets/*",
      etag(),
      async (c, next) => {
        await next();
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    );
    app.use("/*", etag());
    app.use("/*", serveStatic({ root: dist }));

    // SPA fallback
    app.get("/*", (c) => {
      if (indexHtml) return c.html(indexHtml);
      return c.text("Not found — run `bun run build` first", 404);
    });

    // -- Error handling --------------------------------------------
    app.onError((err, c) => {
      if (err instanceof SyntaxError) return c.json({ error: "invalid JSON body" }, 400);
      if (err instanceof ServiceError) return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
      console.error(err);
      return c.json({ error: "internal server error" }, 500);
    });

    // -- WebSocket client tracking ---------------------------------
    const wsClients = new Set<ServerWebSocket<unknown>>();

    ctx.eventBus.subscribe((event: DomainEvent) => {
      const msg = JSON.stringify(event);
      for (const ws of wsClients) {
        try {
          if (ws.readyState === 1) {
            ws.send(msg);
          } else {
            wsClients.delete(ws);
          }
        } catch {
          wsClients.delete(ws);
        }
      }
    });

    Bun.serve({
      port,
      hostname: host,
      fetch(req, server) {
        // WebSocket upgrade
        if (new URL(req.url).pathname === "/ws") {
          if (server.upgrade(req)) return undefined;
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return app.fetch(req, server);
      },
      websocket: {
        open(ws) {
          wsClients.add(ws);
        },
        close(ws) {
          wsClients.delete(ws);
        },
        message() {
          // broadcast-only — client messages are ignored
        },
      },
    });

    logListening("tab-at-home", host, port);
  }
}

// Direct execution
if (import.meta.main) {
  new Server().start();
}
