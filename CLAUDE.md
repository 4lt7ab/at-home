# 4lt7ab/at-home

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

at-home -- a simple notes app with real-time updates. Bun + Hono backend, React frontend, PostgreSQL database, MCP integration.

## Development

The dev API runs at `http://localhost:3100`. When doing development work, test against this local server.

## Commands

```bash
bun run dev          # Start dev server (API :3100 + web :3102, hot-reload)
bun run build        # Build web assets to src/web/dist/
bun run serve        # Build + start production server
bun run start:mcp    # Start standalone MCP server

bun test             # Run ALL tests (domain + web). Always use this.
bun run test:web     # Frontend tests only (Vitest, once)
bun run test:web:watch  # Frontend tests in watch mode

# Single test file
bun test src/domain/integration.test.ts
bun test --grep "test name pattern"
cd src/web && npx vitest run src/hooks/useNotes.test.ts

./deploy.sh patch    # Bump patch, tag, push (also: minor, major)
```

**Testing rule**: `bun test` must run all tests in the project. If you add new test files, ensure they are picked up by `bun test`. Do not create separate test commands — all tests funnel through `bun test`.

## Architecture

Clean architecture with three transport layers sharing a common domain:

```
Web UI (React/Vite)  -+
HTTP API (Hono)       -+---> NoteService -> NoteRepository -> PostgreSQL
MCP Server            -+          |
                            EventBus -> WebSocket broadcast
```

**Domain layer** (`src/domain/`): Note entity, NoteService, NoteRepository, EventBus. All business logic lives here. Services are wired through `AppContext` (DI container in `bootstrap.ts`).

**Server layer** (`src/server/`): Hono routes under `/api/notes`, health check at `/api/health`, WebSocket at `/ws`, MCP at `/mcp`. Serves built web assets in production with SPA fallback.

**Web layer** (`src/web/`): React 19 SPA with a single NoteListPage. Hooks encapsulate data fetching and business logic. Real-time updates via WebSocket subscription to domain events.

**MCP layer** (`src/mcp/`): 5 Model Context Protocol tools for AI client integration (list, get, create, update, delete notes). Tool schemas defined with Zod, handlers delegate to NoteService.

### Key Patterns

- **Dependency injection**: `AppContext` in `bootstrap.ts` creates and wires the NoteRepository, NoteService, and EventBus
- **Domain events**: `EventBus` pub-sub for real-time WebSocket broadcast on note changes
- **Async throughout**: All repo and service methods are async (returns `Promise<T>`). The `postgres` library uses tagged template queries.
- **Vite alias**: `@domain` maps to `../domain` so frontend can import domain types

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `HOME_HOST` | `0.0.0.0` | Server bind address |
| `HOME_PORT` | `3100` | Server port |
| `HOME_CORS_ORIGINS` | -- | CSV of allowed CORS origins |
| `TEST_DATABASE_URL` | `postgres://tab:tab@localhost:3101/at_home` | Test database (integration tests, uses dev DB by default) |

## Migrations

All database migrations **must be backward compatible**. Users run older app versions against newer schemas during rolling deploys. This means:

- **Add columns** with defaults or as nullable — never add NOT NULL without a default
- **Drop columns** only after the previous release no longer references them
- **Rename** via add-new → migrate-data → drop-old across releases, never in one step
- **Never drop tables** that the prior release still queries

Migrations run automatically on startup. A migration that breaks the prior version breaks every user mid-upgrade.

## Versioning

Semver tracked in `package.json` (`version` field). Releases are git tags (`v0.1.0`, `v0.2.0`, etc.).

- **Patch** (`0.1.x`): bug fixes, no schema changes
- **Minor** (`0.x.0`): new features, backward-compatible migrations
- **Major** (`x.0.0`): breaking changes (schema or API)

Deploy with `./deploy.sh [patch|minor|major]` — bumps version, commits, tags, and pushes.

## Tech Stack

- **Runtime**: Bun 1.3+ (see `.tool-versions`)
- **Backend**: Hono, PostgreSQL via `postgres` (porsager/postgres), migrations in `src/domain/db/migrations/`
- **Frontend**: React 19, Vite, TypeScript strict, @4lt7ab/ui component library
- **Validation**: Zod
- **IDs**: ULID
- **Testing**: `bun:test` (domain), Vitest + Testing Library + jsdom (web)
