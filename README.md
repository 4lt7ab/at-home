# tab-at-home

A personal home task management app that keeps your household running smoothly. It works as three things in one: a **schedule and reminder manager** for recurring chores, a **list keeper** for tracking everything that needs doing, and a **message board** for notes and post-its you can attach to tasks or leave standing on their own.

Open it once a day, see what's due, mark things done, move on.

## Features

- **Daily summary** -- a single view of what's overdue, what's due today, and what's coming up
- **Recurring schedules** -- daily, weekly, monthly, seasonal, or custom recurrence patterns with automatic advancement
- **Notes** -- standalone or linked to tasks; use them as completion logs, reminders, or general-purpose post-its
- **Areas** -- tag tasks by location (kitchen, bathroom, yard, garage, HVAC, plumbing, etc.)
- **Dark mode** -- auto, light, or dark; persisted across sessions
- **Gallery and list views** -- toggle how you browse tasks and notes
- **Real-time updates** -- changes push instantly over WebSocket, no manual refresh needed
- **MCP integration** -- 17 tools for AI client access (Claude Desktop, etc.)
- **Activity log** -- append-only audit trail of every create, update, delete, and completion

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) 1.3 or later.

```bash
# Clone and install
git clone <repo-url> && cd home
bun install

# Start the dev server (API on :3100, web on :3102)
bun run dev

# Open the app
open http://localhost:3100
```

The database is created automatically at `.local/data/sqlite.db` on first run.

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
| `SQLITE_PATH` | *(required)* | Path to the SQLite database file |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port |
| `HOME_CORS_ORIGINS` | -- | Comma-separated list of allowed CORS origins |

In development, `SQLITE_PATH` defaults to `.local/data/sqlite.db` via the npm scripts.

## Docker

```bash
docker compose up -d
```

Data persists to `.docker/data/` on the host via a bind mount. The container runs as a non-root user with resource limits (1 CPU, 512MB memory). The image uses a multi-stage build to keep the final layer lean -- production dependencies only, with pre-built web assets.

To rebuild after code changes:

```bash
docker compose up -d --build
```

## Architecture

The app is built in TypeScript end-to-end. A shared **domain layer** holds all business logic -- entities, services, repositories, and a recurrence engine. Three transport layers sit on top of it: a **Hono HTTP API** with REST routes, a **React SPA** served as static files, and an **MCP server** for AI tool access. An **EventBus** broadcasts domain events over WebSocket so the UI stays in sync without polling.

```
Web UI (React 19)    --+
HTTP API (Hono)      --+--> Services --> Repositories --> SQLite (WAL)
MCP Server           --+         |
                           EventBus --> WebSocket broadcast
```

Data is stored in SQLite with WAL mode enabled. Migrations run automatically on startup.

## Tech Stack

- **Runtime** -- Bun
- **Backend** -- Hono
- **Database** -- SQLite (WAL mode, file-based migrations)
- **Frontend** -- React 19, Vite
- **Language** -- TypeScript (strict)
- **Validation** -- Zod
- **IDs** -- ULID
- **MCP** -- @modelcontextprotocol/sdk
- **Testing** -- bun:test (domain), Vitest + Testing Library (web)

## Project Structure

```
src/
  index.ts                  # Entry point
  domain/                   # Business logic (entities, services, repos, operations)
    entities.ts             #   Entity types + summary projections
    services.ts             #   Service interfaces
    recurrence.ts           #   Recurrence engine (daily/weekly/monthly/seasonal/custom)
    summary.ts              #   Daily summary computation
    bootstrap.ts            #   Dependency injection wiring
    db/migrations/          #   SQL migration files
    repositories/           #   SQLite data access (raw SQL, no ORM)
    services/               #   Service implementations
    operations/             #   Composite transactional workflows
  server/                   # HTTP layer (Hono routes, WebSocket, static serving)
    routes/                 #   /api/tasks, /api/notes, /api/schedules, /api/summary, ...
  mcp/                      # MCP tool definitions (17 tools for AI clients)
  web/                      # React SPA (Vite, hash routing, dark mode, real-time events)
    src/pages/              #   Daily summary, task list, task detail, note list
    src/hooks/              #   Data fetching, routing, theme, event subscription
```
