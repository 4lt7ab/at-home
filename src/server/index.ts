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
import { readFileSync, existsSync, watch as fsWatch } from "fs";
import { bootstrap, ServiceError } from "../domain";
import type { DomainEvent } from "../domain/events";
import { parseArgs, parseCorsOrigins, logListening, type ServerOptions } from "../domain/args";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { noteRoutes } from "./routes/notes";
import { reminderRoutes } from "./routes/reminders";
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
    const { port, host, databaseUrl } = this.options;
    const ctx = await bootstrap(databaseUrl);
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
    app.route("/api/notes", noteRoutes(ctx.noteService));
    app.route("/api/reminders", reminderRoutes(ctx.reminderService));
    app.get("/api/health", async (c) => {
      let dbOk = false;
      try {
        const [row] = await ctx.sql`SELECT 1 AS ok`;
        dbOk = (row as { ok: number })?.ok === 1;
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
      noteService: ctx.noteService,
      noteRepo: ctx.noteRepo,
      reminderService: ctx.reminderService,
    });
    app.all("/mcp", (c) => handleMcp(c.req.raw));

    // -- Static web assets -----------------------------------------
    const dist = join(import.meta.dir, "../web/dist");
    const indexPath = join(dist, "index.html");

    // Keep index.html in memory, reload when Vite rebuilds
    let indexHtml: string | null = existsSync(indexPath)
      ? readFileSync(indexPath, "utf-8")
      : null;

    // Watch for rebuilds so dev mode picks up changes without restart
    try {
      fsWatch(dist, { recursive: true }, (_, filename) => {
        if (filename === "index.html" || filename?.endsWith("index.html")) {
          try { indexHtml = readFileSync(indexPath, "utf-8"); } catch { /* not yet */ }
        }
      });
    } catch { /* dist/ may not exist yet */ }

    // If index.html wasn't ready at startup, poll briefly for Vite's first build
    if (!indexHtml) {
      const poll = setInterval(() => {
        if (existsSync(indexPath)) {
          indexHtml = readFileSync(indexPath, "utf-8");
          clearInterval(poll);
        }
      }, 500);
      // Stop polling after 30s regardless
      setTimeout(() => clearInterval(poll), 30_000);
    }

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
      return c.text("Not found — waiting for initial build (bun run build)", 404);
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

    logListening("at-home", host, port);
  }
}

// Direct execution
if (import.meta.main) {
  new Server().start();
}
