#!/usr/bin/env bun
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bootstrap } from "../domain";
import { parseArgs, parseCorsOrigins, logListening, type ServerOptions } from "../domain/args";
import { createMcpHttpHandler } from "./server";

export class McpStandaloneServer {
  private options: ServerOptions;

  constructor(options?: Partial<ServerOptions>) {
    const defaults = parseArgs({ port: 3101, portEnv: "HOME_MCP_PORT" });
    this.options = { ...defaults, ...options };
  }

  async start(): Promise<void> {
    const { port, host, databaseUrl } = this.options;
    const ctx = await bootstrap(databaseUrl);

    const app = new Hono();
    const isAllowedOrigin = parseCorsOrigins(process.env.HOME_CORS_ORIGINS);
    app.use("*", secureHeaders());
    app.use(
      "*",
      cors({
        origin: (origin) => (origin && isAllowedOrigin(origin)) ? origin : null,
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
        exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
      })
    );
    app.use("*", logger((str) => process.stderr.write(str + "\n")));
    const handleMcp = createMcpHttpHandler(ctx);
    app.all("/*", (c) => handleMcp(c.req.raw));

    logListening("at-home mcp (standalone)", host, port);

    Bun.serve({
      port,
      hostname: host,
      fetch: app.fetch,
    });
  }
}

// Direct execution
if (import.meta.main) {
  new McpStandaloneServer().start();
}
