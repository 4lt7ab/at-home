# at-home

A simple notes app with real-time updates. Write notes with titles and rich text context, and see changes pushed instantly over WebSocket. Includes MCP integration for AI client access.

## Features

- **Notes** -- create, edit, and delete notes with titles and freeform context
- **Real-time updates** -- changes push instantly over WebSocket, no manual refresh needed
- **Dark mode** -- auto, light, or dark; persisted across sessions
- **MCP integration** -- 5 tools for AI client access (Claude Desktop, etc.)

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) 1.3 or later, PostgreSQL.

```bash
# Clone and install
git clone <repo-url> && cd at-home
bun install

# Set up the database
export DATABASE_URL=postgres://localhost/at_home

# Start the dev server (API on :3100, web on :3102)
bun run dev

# Open the app
open http://localhost:3100
```

The database schema is created automatically via migrations on first run.

## Commands

```bash
bun run dev            # Dev server with hot-reload (API :3100 + Vite :3102)
bun run build          # Build frontend assets to src/web/dist/
bun run serve          # Build + start production server
bun run start:mcp      # Start standalone MCP server

bun test               # Domain tests (Bun test runner)
bun run test:web       # Frontend tests (Vitest, single run)
bun run test:web:watch # Frontend tests in watch mode
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *(required)* | PostgreSQL connection string |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port |
| `HOME_CORS_ORIGINS` | -- | Comma-separated list of allowed CORS origins |

## Docker

```bash
docker compose up -d
```

Data persists via PostgreSQL. The container runs as a non-root user with resource limits. The image uses a multi-stage build with production dependencies only and pre-built web assets.

To rebuild after code changes:

```bash
docker compose up -d --build
```

## Architecture

The app is built in TypeScript end-to-end. A shared **domain layer** holds all business logic -- the Note entity, NoteService, and NoteRepository. Three transport layers sit on top: a **Hono HTTP API** with REST routes, a **React SPA** served as static files, and an **MCP server** for AI tool access. An **EventBus** broadcasts domain events over WebSocket so the UI stays in sync without polling.

```
Web UI (React 19)    --+
HTTP API (Hono)      --+--> NoteService --> NoteRepository --> PostgreSQL
MCP Server           --+         |
                           EventBus --> WebSocket broadcast
```

Migrations run automatically on startup.

## Tech Stack

- **Runtime** -- Bun
- **Backend** -- Hono
- **Database** -- PostgreSQL (via `postgres` library)
- **Frontend** -- React 19, Vite, @4lt7ab/ui
- **Language** -- TypeScript (strict)
- **Validation** -- Zod
- **IDs** -- ULID
- **MCP** -- @modelcontextprotocol/sdk
- **Testing** -- bun:test (domain), Vitest + Testing Library (web)

## Project Structure

```
src/
  index.ts                  # Entry point
  domain/                   # Business logic (Note entity, service, repository)
    entities.ts             #   Note entity type
    services.ts             #   Service interface (INoteService)
    inputs.ts               #   Create/Update input types
    errors.ts               #   ServiceError class
    events.ts               #   EventBus pub-sub
    bootstrap.ts            #   Dependency injection wiring
    db/migrations/          #   SQL migration files
    repositories/notes.ts   #   PostgreSQL data access
    services/notes.ts       #   NoteService implementation
  server/                   # HTTP layer (Hono routes, WebSocket, static serving)
    routes/notes.ts         #   /api/notes CRUD
  mcp/                      # MCP tool definitions (5 tools for AI clients)
  web/                      # React SPA (NoteListPage, hooks, real-time events)
    src/pages/              #   NoteListPage
    src/hooks/              #   Data fetching, routing, theme, event subscription
```

## License

Licensed under the Apache License 2.0 -- see [LICENSE](LICENSE) for details.
