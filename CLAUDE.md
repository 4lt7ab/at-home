# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

tab-at-home — a full-stack TypeScript home task management app with recurring schedules, notes, activity tracking, and real-time updates. Runs on Bun with a Hono backend, React frontend, and SQLite database.

## Commands

```bash
bun run dev          # Start dev server (API :3100 + web :3102, hot-reload)
bun run build        # Build web assets to src/web/dist/
bun run serve        # Build + start production server
bun run start:mcp    # Start standalone MCP server

bun test             # Domain tests (Bun test, rooted at src/domain/)
bun run test:web     # Frontend tests (Vitest, once)
bun run test:web:watch  # Frontend tests in watch mode

# Single test file
bun test src/domain/integration.test.ts
bun test --grep "test name pattern"
cd src/web && npx vitest run src/hooks/useTheme.test.ts
```

## Architecture

Clean architecture with three transport layers sharing a common domain:

```
Web UI (React/Vite)  ─┐
HTTP API (Hono)       ─┼─→ Services → Repositories → SQLite (WAL)
MCP Server            ─┘         ↓
                           EventBus → WebSocket broadcast
```

**Domain layer** (`src/domain/`): Entities, services, repositories, operations. All business logic lives here. Services implement interfaces (`IHomeTaskService`, etc.) and are wired through `AppContext` (DI container in `bootstrap.ts`).

**Server layer** (`src/server/`): Hono routes under `/api/*`, WebSocket at `/ws`, MCP at `/mcp`. Serves built web assets in production with SPA fallback.

**Web layer** (`src/web/`): React 19 SPA with hash-based routing (`useHashRoute`). Hooks encapsulate data fetching and business logic. Real-time updates via WebSocket subscription to domain events.

**MCP layer** (`src/mcp/`): Model Context Protocol tools for AI client integration. Tool schemas defined with Zod, handlers delegate to domain services.

### Key Patterns

- **Dependency injection**: `AppContext` in `bootstrap.ts` creates and wires all services/repos
- **Domain events**: `EventBus` pub-sub for real-time WebSocket broadcast on entity changes
- **Atomic operations**: `completeTask()` in `src/domain/operations/` uses SQLite transactions for multi-step consistency (update task + advance schedule + create note)
- **Recurrence rules**: Discriminated union `RecurrenceRule` with date calculation logic in `recurrence.ts`
- **Entity summaries**: List endpoints return lightweight DTOs; detail endpoints return full entities
- **Vite alias**: `@domain` maps to `../domain` so frontend can import domain types

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SQLITE_PATH` | (required) | Path to SQLite database file |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port |
| `HOME_CORS_ORIGINS` | — | CSV of allowed CORS origins |

## Tech Stack

- **Runtime**: Bun 1.3+ (see `.tool-versions`)
- **Backend**: Hono, SQLite (with migrations in `src/domain/db/migrations/`)
- **Frontend**: React 19, Vite, TypeScript
- **Validation**: Zod
- **IDs**: ULID
- **Testing**: `bun:test` (domain), Vitest + Testing Library + jsdom (web)
