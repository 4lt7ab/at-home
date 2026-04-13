# Developer Guide

This guide covers how to work on the at-home codebase. It complements the README (which covers how to run the app) with how to develop, test, and extend it.

## Prerequisites

- **Bun 1.3+** -- the runtime, package manager, test runner, and bundler. Install via [bun.sh](https://bun.sh) or use the version pinned in `.tool-versions`.
- **PostgreSQL** -- the database. Create a database and set `DATABASE_URL`.

## Dev Environment Setup

```bash
# Clone and install
git clone <repo-url> && cd at-home
bun install

# Set up the database
export DATABASE_URL=postgres://localhost/at_home

# Start development server
bun run dev
```

`bun run dev` starts two processes via `concurrently`:

1. **API server** on `http://localhost:3100` -- runs `src/index.ts` with `--watch` for automatic reload on file changes.
2. **Vite build watcher** -- runs `vite build --watch` in `src/web/`, rebuilding frontend assets to `src/web/dist/` on every change. The API server serves these static files.

The API server also exposes:
- **WebSocket** at `ws://localhost:3100/ws` for real-time domain events
- **MCP endpoint** at `http://localhost:3100/mcp` for AI client integration
- **Health check** at `http://localhost:3100/api/health`

## Project Structure

```
src/
  index.ts                  # Entry point -- creates Server, calls start()
  domain/                   # Business logic (Note entity, service, repository)
  server/                   # HTTP layer (Hono routes, WebSocket, static serving)
  mcp/                      # MCP server (tool definitions, standalone mode)
  web/                      # React SPA (NoteListPage, hooks)
```

### Dependency Direction

All three transport layers depend on the domain. The domain never depends on them.

```
web ----+
server -+--> domain (entities, services, repositories)
mcp ----+
```

### Domain Layer (`src/domain/`)

All business logic lives here. Nothing in this layer imports from `server/`, `mcp/`, or `web/`.

| Path | Purpose |
|------|---------|
| `entities.ts` | `Note` interface (id, title, context, created_at, updated_at) |
| `inputs.ts` | `CreateNoteInput` and `UpdateNoteInput` interfaces |
| `services.ts` | `INoteService` interface |
| `errors.ts` | `ServiceError` class with `message` and `statusCode` |
| `events.ts` | `EventBus` pub/sub and `DomainEvent` type |
| `bootstrap.ts` | Dependency injection -- wires DB, repo, service, event bus into `AppContext` |
| `db/migrations/` | Numbered `.sql` migration files |
| `repositories/notes.ts` | NoteRepository (raw SQL via `postgres` library, no ORM) |
| `services/notes.ts` | NoteService (validation, domain events) |

### Server Layer (`src/server/`)

Hono HTTP application. Routes live in `src/server/routes/` and follow a consistent pattern: parse request, call service, return JSON.

| Route | Handler |
|-------|---------|
| `/api/notes` | CRUD for notes |
| `/api/health` | Health check (DB status, version, uptime) |
| `/mcp` | MCP protocol endpoint |
| `/ws` | WebSocket (broadcast-only, server pushes domain events) |

### MCP Layer (`src/mcp/`)

5 MCP tools registered with Zod input schemas. Tool handlers delegate to NoteService. Two modes:

- **Embedded** -- mounted at `/mcp` on the main server (port 3100)
- **Standalone** -- separate HTTP server via `src/mcp/standalone.ts` (port 3101 by default)

### Web Layer (`src/web/`)

React 19 SPA with hash-based routing. Uses `@4lt7ab/ui` component library.

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Shell layout, hash router, theme toggle |
| `src/api.ts` | Fetch wrapper for all REST API calls |
| `src/useRealtimeEvents.ts` | WebSocket connection with auto-reconnect |
| `src/hooks/` | Data fetching (useNotes), routing, theme, hotkeys |
| `src/pages/NoteListPage.tsx` | Single page: note list with create overlay |
| `src/test/` | Test setup, render helpers |

The Vite config defines an `@domain` alias that maps to `../domain`, allowing the frontend to import domain types directly.

## Key Architectural Patterns

### Bootstrap and Dependency Injection

`bootstrap()` in `src/domain/bootstrap.ts` is the composition root. It creates the database connection, runs migrations, instantiates the NoteRepository, creates the EventBus, wires the NoteService, and returns an `AppContext`.

No DI framework -- manual constructor injection.

### Repository Pattern

`NoteRepository` takes a `postgres` SQL connection in its constructor. It uses raw SQL with tagged template queries (no ORM). Standard methods: `findById`, `findMany` (with filter object), `count`, `insertMany`, `updateMany`, `deleteMany`. IDs are generated via `ulid()` at insert time.

### Service Pattern

`NoteService` implements the `INoteService` interface. It:

1. **Validates inputs** -- checks required fields, string lengths
2. **Calls the repository** -- performs the actual CRUD operation
3. **Emits domain events** -- notifies the `EventBus` so WebSocket clients receive real-time updates

Services throw `ServiceError` for client errors (400-level). The HTTP layer and MCP layer both catch `ServiceError` and format it appropriately for their transport.

### Event Bus

Simple synchronous pub/sub. The service emits `DomainEvent` objects (with `type`, `entity_type`, and `payload`) after mutations. The server subscribes to the bus and broadcasts events as JSON to all connected WebSocket clients. Listener errors are silently caught to prevent breaking the emitter.

## Testing

Two separate test suites with different runners.

### Domain Tests (Bun test)

```bash
bun test                                    # Run all domain tests
bun test src/domain/integration.test.ts     # Single file
bun test --grep "pattern"                   # Filter by test name
```

- **Runner**: Bun's built-in test runner (`bun:test`)
- **Files**: `src/domain/integration.test.ts`

The integration tests use a real PostgreSQL database (configured via `TEST_DATABASE_URL`), bootstrapped with the same `bootstrap()` function the production app uses.

### Frontend Tests (Vitest)

```bash
bun run test:web                            # Run once
bun run test:web:watch                      # Watch mode
cd src/web && npx vitest run src/hooks/useNotes.test.ts  # Single file
```

- **Runner**: Vitest with jsdom environment
- **Files**: Test files across hooks, pages, and the API client

Key infrastructure:

- **Setup file** (`src/web/src/test/setup.ts`): Polyfills `localStorage` and `window.matchMedia`
- **Render helpers** (`src/web/src/test/render-helpers.tsx`): `renderWithProviders()` wraps components in required context providers
- **Mocking**: Tests mock `globalThis.fetch` or use `vi.mock()` to stub API modules and hooks

### Test Conventions

- Domain test files: `src/domain/*.test.ts`
- Frontend test files: `src/web/src/**/*.test.{ts,tsx}`
- Hook tests use `renderHook` from testing library
- Page tests mock all hooks to isolate rendering logic
- Components that need theme or event context must use `renderWithProviders`

## Database

### PostgreSQL

The app uses PostgreSQL via the `postgres` library (porsager/postgres). The connection is created in `src/domain/db/connection.ts`.

### Migrations

File-based, numbered migrations in `src/domain/db/migrations/`. Applied automatically on startup by `bootstrap()`.

**How it works:**

1. On startup, `bootstrap()` runs migrations
2. The migrator checks for already-applied migrations
3. Any new migration files (sorted alphabetically) are applied in order

**To add a new migration:**

1. Create a file with the next sequential number: `src/domain/db/migrations/003_your_change.sql`
2. Write your DDL statements
3. Restart the dev server -- the migration runs automatically on startup

**Current migrations:**

| File | Purpose |
|------|---------|
| `001_initial.sql` | Initial schema setup |
| `002_notes_only.sql` | Notes table: `id`, `title`, `context`, `created_at`, `updated_at` |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port (full server) |
| `HOME_MCP_PORT` | `3101` | Standalone MCP server port |
| `HOME_CORS_ORIGINS` | -- | Comma-separated list of allowed CORS origins |
| `TEST_DATABASE_URL` | `postgres://localhost/at_home_test` | Test database |

## MCP Development

### How It Works

The MCP server (`src/mcp/server.ts`) registers 5 tools using `@modelcontextprotocol/sdk`. Each tool has a Zod input schema and a handler that delegates to NoteService.

| Tool | Description |
|------|-------------|
| `list_notes` | List notes with optional title search |
| `get_note` | Get a single note by ID |
| `create_note` | Create one or more notes |
| `update_note` | Update one or more notes |
| `delete_notes` | Delete notes by ID |

### Embedded vs Standalone

- **Embedded mode** (default): The MCP endpoint is mounted at `/mcp` on the main server. No separate process needed.
- **Standalone mode**: Run `bun run start:mcp` to start a dedicated MCP-only HTTP server on port 3101.

### HTTP Transport

The MCP server uses `WebStandardStreamableHTTPServerTransport` with `enableJsonResponse: true`. Each incoming request gets its own transport instance. Requests are serialized through a promise chain to prevent concurrent access issues.

## Docker

### Building

```bash
docker build -t at-home .
```

The Dockerfile uses a multi-stage build:

1. **deps** -- installs production dependencies only
2. **build** -- installs all dependencies and runs `vite build`
3. **runtime** -- copies production deps, source files, and built assets into the final image

### Running

```bash
docker run -d \
  --name at-home \
  -p 3100:3100 \
  -e DATABASE_URL=postgres://host/at_home \
  at-home
```

The container runs as a non-root user. A health check polls `GET /api/health`.

## Conventions and Gotchas

### Validation at the Boundary

HTTP routes validate query parameters before calling services. MCP tools get this for free from Zod schemas.

### LIKE Query Escaping

Any LIKE query must use `escapeLike()`. Parameterized queries prevent SQL injection but do not prevent wildcard interpretation of `%` and `_` in user input.

### MCP Update Schemas

Update tool Zod schemas use `.optional().nullable()` for nullable fields (so clients can send `null` to clear a field). Create schemas use `.optional()` only.

### Frontend Context Providers

Any React component that uses theme or event subscription context must be wrapped in the appropriate provider. In tests, use `renderWithProviders()` from the test helpers.
