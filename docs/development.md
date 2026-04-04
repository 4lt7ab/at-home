# Developer Guide

This guide covers how to work on the tab-at-home codebase. It complements the README (which covers how to run the app) with how to develop, test, and extend it.

## Prerequisites

- **Bun 1.3+** -- the runtime, package manager, test runner, and bundler. Install via [bun.sh](https://bun.sh) or use the version pinned in `.tool-versions` (`bun 1.3.11`).
- **No other dependencies required.** SQLite is built into Bun's runtime (`bun:sqlite`), so there is no native module compilation or system-level database to install.
- **Node.js** is listed in `.tool-versions` but is not required for development. Vitest (the frontend test runner) uses it under the hood, but Bun handles that transparently.

## Dev Environment Setup

```bash
# Clone and install
git clone <repo-url> && cd tab-at-home
bun install

# Start development server
bun run dev
```

`bun run dev` starts two processes via `concurrently`:

1. **API server** on `http://localhost:3100` -- runs `src/index.ts` with `--watch` for automatic reload on file changes. Uses `SQLITE_PATH=.local/data/sqlite.db` by default.
2. **Vite build watcher** -- runs `vite build --watch` in `src/web/`, rebuilding frontend assets to `src/web/dist/` on every change. The API server serves these static files.

The API server also exposes:
- **WebSocket** at `ws://localhost:3100/ws` for real-time domain events
- **MCP endpoint** at `http://localhost:3100/mcp` for AI client integration
- **Health check** at `http://localhost:3100/api/health`

## Project Structure

```
src/
  index.ts                  # Entry point -- creates Server, calls start()
  domain/                   # Business logic (entities, services, repos, operations)
  server/                   # HTTP layer (Hono routes, WebSocket, static serving)
  mcp/                      # MCP server (tool definitions, standalone mode)
  web/                      # React SPA (pages, hooks, components)
```

### Dependency Direction

All three transport layers depend on the domain. The domain never depends on them.

```
web ──┐
server ┼──> domain (entities, services, repositories, operations)
mcp ──┘
```

This means you can change an HTTP route, an MCP tool, or a React page without touching business logic, and you can change business logic without touching any transport layer (as long as interfaces are stable).

### Domain Layer (`src/domain/`)

All business logic lives here. Nothing in this layer imports from `server/`, `mcp/`, or `web/`.

| Path | Purpose |
|------|---------|
| `entities.ts` | Entity interfaces (`HomeTask`, `Note`, `Schedule`, `ActivityLog`), value-type const arrays (`TASK_STATUSES`, `AREAS`, etc.), summary types and mapper functions |
| `inputs.ts` | Create/Update input interfaces for each entity |
| `services.ts` | Service interfaces (`IHomeTaskService`, `INoteService`, `IScheduleService`) |
| `errors.ts` | `ServiceError` class with `message` and `statusCode` |
| `events.ts` | `EventBus` pub/sub and `DomainEvent` type |
| `bootstrap.ts` | Dependency injection -- wires DB, repos, services, event bus into `AppContext` |
| `recurrence.ts` | `RecurrenceRule` discriminated union, `nextDue()`, `recurrenceLabel()`, `daysOverdue()` |
| `summary.ts` | `buildDailySummary()` -- computed read-only daily view |
| `db/connection.ts` | SQLite database creation with WAL mode and PRAGMAs |
| `db/migrator.ts` | File-based migration runner |
| `db/migrations/` | Numbered `.sql` and `.ts` migration files |
| `repositories/` | One repository class per entity (raw SQL, no ORM) |
| `services/` | One service class per entity (validation, activity logging, events) |
| `operations/` | Composite transactional workflows (currently `completeTask`) |

### Server Layer (`src/server/`)

Hono HTTP application. Routes live in `src/server/routes/` and follow a consistent pattern: parse request, call service, return JSON.

| Route | Handler |
|-------|---------|
| `/api/tasks` | CRUD for home tasks |
| `/api/notes` | CRUD for notes |
| `/api/schedules` | CRUD for schedules |
| `/api/activity-log` | Read-only activity log |
| `/api/summary` | Daily summary (computed view) |
| `/api/health` | Health check (DB status, version, uptime) |
| `/mcp` | MCP protocol endpoint |
| `/ws` | WebSocket (broadcast-only, server pushes domain events) |

### MCP Layer (`src/mcp/`)

17 MCP tools registered with Zod input schemas. Tool handlers delegate to domain services. Two modes:

- **Embedded** -- mounted at `/mcp` on the main server (port 3100)
- **Standalone** -- separate HTTP server via `src/mcp/standalone.ts` (port 3101 by default)

### Web Layer (`src/web/`)

React 19 SPA with hash-based routing. No CSS framework -- inline styles with CSS custom properties for theming.

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Shell layout, nav bar, hash router, theme toggle |
| `src/api.ts` | Fetch wrapper for all REST API calls |
| `src/useRealtimeEvents.ts` | WebSocket connection with auto-reconnect |
| `src/hooks/` | Data fetching hooks, routing, theme, hotkeys |
| `src/pages/` | Four pages: DailySummary, TaskList, TaskDetail, NoteList |
| `src/components/` | Shared components (StatusDot) |
| `src/test/` | Test setup, render helpers, data factories |

The Vite config defines an `@domain` alias that maps to `../domain`, allowing the frontend to import domain types directly.

## Key Architectural Patterns

### Bootstrap and Dependency Injection

`bootstrap()` in `src/domain/bootstrap.ts` is the composition root. It creates the SQLite database, runs migrations, instantiates all repositories, creates the `EventBus`, wires services with their dependencies, and returns an `AppContext`.

```typescript
export interface AppContext {
  db: Database;
  eventBus: EventBus;
  homeTaskRepo: HomeTaskRepository;
  noteRepo: NoteRepository;
  scheduleRepo: ScheduleRepository;
  activityLogRepo: ActivityLogRepository;
  homeTaskService: HomeTaskService;
  noteService: NoteService;
  scheduleService: ScheduleService;
}
```

No DI framework -- manual constructor injection. Both services and repositories are exposed on the context because the summary module and MCP composite tools need direct read access to repositories.

### Repository Pattern

Each entity has a repository class that takes `Database` in its constructor. Repositories use raw SQL with parameterized queries (no ORM). Standard methods: `findById`, `findMany` (with filter object), `count`, `insertMany`, `updateMany`, `deleteMany`. IDs are generated via `ulid()` at insert time.

The `ScheduleRepository` adds domain-specific query methods: `findDueOrOverdue(date)` and `findUpcoming(date, endDate)`.

### Service Pattern

Each entity has a service class implementing a typed interface (`IHomeTaskService`, etc.). Services:

1. **Validate inputs** -- check required fields, enum membership, string lengths, foreign key existence
2. **Call repositories** -- perform the actual CRUD operation
3. **Log activity** -- write to the activity log repository
4. **Emit domain events** -- notify the `EventBus` so WebSocket clients receive real-time updates

Services throw `ServiceError` for client errors (400-level). The HTTP layer and MCP layer both catch `ServiceError` and format it appropriately for their transport.

### Operations Pattern

Composite operations that span multiple services live in `src/domain/operations/`. Each operation is a standalone function (not a class) that wraps its logic in `db.transaction()` for atomicity.

Currently one operation exists: `completeTask()`, which atomically updates the task, advances the schedule, and optionally creates a completion note. If any step fails, everything rolls back.

The operation uses `eventBus.startBuffer()` before the transaction and `eventBus.flush()` on success / `eventBus.discard()` on failure, ensuring that domain events are not broadcast for rolled-back mutations.

### Event Bus

Simple synchronous pub/sub. Services emit `DomainEvent` objects (with `type`, `entity_type`, and `payload`) after mutations. The server subscribes to the bus and broadcasts events as JSON to all connected WebSocket clients. Listener errors are silently caught to prevent breaking the emitter.

### Summary Module

`buildDailySummary()` in `src/domain/summary.ts` is a pure read function that computes a daily actionable view (overdue items, due today, upcoming). It reads directly from repositories (not services) because it performs no mutations and is never persisted.

## How to Add a New Feature (End-to-End)

This walkthrough shows the typical flow for adding a new entity or extending an existing one. Not every feature touches every layer, but this is the full path.

### 1. Define the Entity

Add the entity interface, summary type, and mapper function to `src/domain/entities.ts`. Add const arrays for any enum fields (e.g., status values, category values).

### 2. Write a Migration

Create a new numbered `.sql` file in `src/domain/db/migrations/`:

```
src/domain/db/migrations/003_your_feature.sql
```

The migrator picks up files in alphabetical order. Use the next sequential number. The migration runs inside a transaction automatically.

### 3. Create the Repository

Add a new file in `src/domain/repositories/`. Follow the existing pattern:

- Constructor takes `Database`
- Standard methods: `findById`, `findMany`, `count`, `insertMany`, `updateMany`, `deleteMany`
- Use parameterized queries (`?` placeholders) for all user input
- Escape LIKE patterns with `escapeLike()` if you add search/filter by title
- Generate IDs with `ulid()`

### 4. Create the Service

Add a new file in `src/domain/services/`. Follow the existing pattern:

- Define an interface in `src/domain/services.ts`
- Constructor takes the entity repository, any related repositories, the activity log repository, and the event bus
- Validate inputs before calling the repository
- Log activity after mutations
- Emit domain events after mutations
- Throw `ServiceError` for validation failures

### 5. Wire into Bootstrap

Update `src/domain/bootstrap.ts`:
- Import the new repository and service
- Add them to the `AppContext` interface
- Instantiate them in `bootstrap()` and include in the returned context

### 6. Add MCP Tools

Register tools in `src/mcp/server.ts` using `server.registerTool()`. Define input schemas with Zod. Use the `handle()` wrapper to catch `ServiceError` and return MCP-formatted error responses.

Update `McpServiceContext` if your tools need access to new services or repositories.

### 7. Add HTTP Routes

Create a route file in `src/server/routes/`. Follow the existing pattern:

- Export a factory function that takes the service (or context) and returns a `Hono` instance
- Validate query parameters at the route level (check enum membership against const arrays)
- Mount the routes in `src/server/index.ts`

### 8. Add Frontend Hooks

Create a data-fetching hook in `src/web/src/hooks/`. Follow the existing pattern:

- Fetch from the REST API via functions in `api.ts`
- Return `{ data, loading, error, refetch }`
- Use `useEntitySubscription` to auto-refetch when domain events arrive for the entity type

Add the corresponding API functions to `src/web/src/api.ts`.

### 9. Add Frontend Pages

Create a page component in `src/web/src/pages/`. Register it in the hash router in `App.tsx`.

### 10. Write Tests

- **Domain integration tests**: add cases to `src/domain/integration.test.ts` using the shared `AppContext`
- **Frontend hook tests**: create `src/web/src/hooks/useYourHook.test.ts`
- **Frontend page tests**: create `src/web/src/pages/YourPage.test.tsx`

## Testing

Two separate test suites with different runners.

### Domain Tests (Bun test)

```bash
bun test                                    # Run all domain tests
bun test src/domain/integration.test.ts     # Single file
bun test --grep "pattern"                   # Filter by test name
```

- **Runner**: Bun's built-in test runner (`bun:test`)
- **Files**: `src/domain/recurrence.test.ts` (80 unit tests) and `src/domain/integration.test.ts` (54 integration tests)
- **Total**: 134 tests

The integration tests use a real SQLite database in a temp directory, bootstrapped with the same `bootstrap()` function the production app uses. Tests share a single database instance, so data accumulates across tests. Use `.some()` for list assertions, not exact array equality.

For atomicity/rollback tests, the codebase uses a monkey-patching pattern: temporarily replace a service method with a throwing stub, exercise the code, then restore the original in a `finally` block.

### Frontend Tests (Vitest)

```bash
bun run test:web                            # Run once
bun run test:web:watch                      # Watch mode
cd src/web && npx vitest run src/hooks/useTheme.test.ts  # Single file
```

- **Runner**: Vitest with jsdom environment
- **Files**: 17 test files across hooks, pages, components, and the API client
- **Total**: 280 tests

Key infrastructure:

- **Setup file** (`src/web/src/test/setup.ts`): Polyfills `localStorage` (required for Node 22+ compatibility) and `window.matchMedia`
- **Render helpers** (`src/web/src/test/render-helpers.tsx`): `renderWithProviders()` wraps components in required context providers (theme, event subscription). Also exports test data factories (`makeHomeTaskSummary`, `makeNoteSummary`, etc.)
- **Mocking**: Tests mock `globalThis.fetch` or use `vi.mock()` to stub API modules and hooks

### Test Conventions

- Domain test files: `src/domain/*.test.ts`
- Frontend test files: `src/web/src/**/*.test.{ts,tsx}`
- Hook tests use `renderHook` from testing library
- Page tests mock all hooks to isolate rendering logic
- Component tests that need theme or event context must use `renderWithProviders`
- Always import test utilities from `../test/render-helpers` (adjust depth as needed)

## Database

### SQLite with WAL Mode

The app uses SQLite via `bun:sqlite`. The database is created in `src/domain/db/connection.ts` with these PRAGMAs:

| PRAGMA | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | WAL | Write-ahead logging for concurrent reads during writes |
| `foreign_keys` | ON | Enforce foreign key constraints |
| `busy_timeout` | 5000 | Wait up to 5 seconds for locks instead of failing immediately |
| `synchronous` | NORMAL | Balance between safety and performance |
| `journal_size_limit` | 67108864 | Cap WAL file at 64MB |

### Migrations

File-based, numbered migrations in `src/domain/db/migrations/`. The migrator (`src/domain/db/migrator.ts`) supports both `.sql` and `.ts` files.

**How it works:**

1. On startup, `bootstrap()` calls `runMigrations(db)`
2. The migrator checks the `schema_migrations` table for already-applied migrations
3. Any new migration files (sorted alphabetically) are applied in order
4. Each migration runs inside a transaction
5. Before applying pending migrations, the migrator automatically backs up the database file

**To add a new migration:**

1. Create a file with the next sequential number: `src/domain/db/migrations/003_your_feature.sql`
2. Write your DDL statements (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.)
3. Restart the dev server -- the migration runs automatically on startup

For migrations that need programmatic logic, use a `.ts` file that exports an `up(db: Database)` function.

**Current migrations:**

| File | Purpose |
|------|---------|
| `001_schema.sql` | Core tables: `home_tasks`, `notes`, `schedules` with indexes and foreign keys |
| `002_activity_log.sql` | `activity_log` table with entity and timestamp indexes |

### Foreign Key Cascades

Be aware of the cascade rules defined in `001_schema.sql`:

- Deleting a task **cascades** to its schedules (`ON DELETE CASCADE`)
- Deleting a task **nullifies** `task_id` on linked notes (`ON DELETE SET NULL`)
- The `HomeTaskService.remove()` method explicitly emits events for these cascaded changes so WebSocket clients stay in sync

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SQLITE_PATH` | (required) | Path to SQLite database file |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port (full server) |
| `HOME_MCP_PORT` | `3101` | Standalone MCP server port |
| `HOME_CORS_ORIGINS` | -- | Comma-separated list of allowed CORS origins |

In development, `bun run dev` automatically sets `SQLITE_PATH=.local/data/sqlite.db`. The database file and its directory are created automatically if they do not exist.

## MCP Development

### How It Works

The MCP server (`src/mcp/server.ts`) registers 17 tools using `@modelcontextprotocol/sdk`. Each tool has a Zod input schema and a handler that delegates to domain services.

Tools are organized by entity:

| Entity | Tools |
|--------|-------|
| HomeTask | `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_tasks` |
| Note | `list_notes`, `get_note`, `create_note`, `update_note`, `delete_notes` |
| Schedule | `list_schedules`, `get_schedule`, `create_schedule`, `update_schedule`, `delete_schedules` |
| Composite | `get_daily_summary`, `complete_task` |

### Embedded vs Standalone

- **Embedded mode** (default): The MCP endpoint is mounted at `/mcp` on the main server. No separate process needed.
- **Standalone mode**: Run `bun run start:mcp` to start a dedicated MCP-only HTTP server on port 3101. Uses its own Hono app with CORS and logging middleware.

### HTTP Transport

The MCP server uses `WebStandardStreamableHTTPServerTransport` with `enableJsonResponse: true`. Each incoming request gets its own transport instance. The server connects, handles the request, then closes the transport. Requests are serialized through a promise chain to prevent concurrent access issues.

### Testing MCP Tools

You can test MCP tools using any MCP-compatible client, or by sending HTTP requests directly:

```bash
# Initialize session
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Call a tool
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tasks","arguments":{}}}'
```

## Docker

### Building

```bash
docker build -t tab-at-home .
```

The Dockerfile uses a multi-stage build:

1. **deps** -- installs production dependencies only (`--frozen-lockfile --production`)
2. **build** -- installs all dependencies and runs `vite build` to compile frontend assets
3. **runtime** -- copies production deps, source files, and built assets into the final image

### Running

```bash
docker run -d \
  --name tab-at-home \
  -p 3100:3100 \
  -v tab-at-home-data:/app/data \
  tab-at-home
```

Key details:

- **Data volume**: Mount `/app/data` to persist the SQLite database across container restarts
- **Default environment**: `HOME_HOST=0.0.0.0`, `HOME_PORT=3100`, `SQLITE_PATH=/app/data/sqlite.db`
- **Non-root**: The container runs as the `bun` user (not root)
- **Health check**: Docker is configured with a healthcheck that polls `GET /api/health` using `bun -e` with `fetch` (no `curl` dependency required). The container reports healthy after a 10-second start period, checking every 30 seconds with a 10-second timeout and 3 retries

To override environment variables:

```bash
docker run -d \
  -p 8080:8080 \
  -e HOME_PORT=8080 \
  -v tab-at-home-data:/app/data \
  tab-at-home
```

## Conventions and Gotchas

### Validation at the Boundary

HTTP routes validate enum query parameters against const arrays (`TASK_STATUSES`, `AREAS`, etc.) before calling services. MCP tools get this for free from Zod schemas. If you add a new enum used in HTTP query params, validate it at the route level.

### Date Handling

All dates are local date strings (`YYYY-MM-DD`) with no time component. The recurrence engine uses local dates throughout. Use `isValidDateString()` from `recurrence.ts` to validate date inputs -- regex alone is not sufficient (it would accept `2026-02-30`).

### LIKE Query Escaping

Any LIKE query must use `escapeLike()` and the `ESCAPE '\\'` clause. Parameterized queries prevent SQL injection but do not prevent wildcard interpretation of `%` and `_` in user input.

### EventBus Buffering for Transactions

Any composite operation that wraps multiple service calls in `db.transaction()` must use `eventBus.startBuffer()` before the transaction, `eventBus.flush()` on success, and `eventBus.discard()` on failure. This prevents broadcasting events for mutations that get rolled back.

### MCP Update Schemas

Update tool Zod schemas use `.optional().nullable()` for nullable fields (so clients can send `null` to clear a field). Create schemas use `.optional()` only (null on create is meaningless).

### Frontend Context Providers

Any React component that uses `useThemeContext()` or `useEntitySubscription()` must be wrapped in the appropriate provider. In tests, use `renderWithProviders()` from the test helpers.
