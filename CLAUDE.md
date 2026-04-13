# 4lt7ab/at-home

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

at-home -- a notes and reminders app with real-time updates. Bun + Hono backend, React frontend, PostgreSQL database, MCP integration.

## Development

The dev API runs at `http://localhost:3100`. When doing development work, test against this local server.

## Commands

```bash
bun run dev          # Start dev server (API :3100 + web :3102, hot-reload)
bun run build        # Build web assets to src/web/dist/
bun run serve        # Build + start production server
bun run start:mcp    # Start standalone MCP server

bun run test         # Run ALL tests. Always use this.
bun run test:web:watch  # Frontend tests in watch mode
bun run seed         # Seed dev DB with realistic test data (idempotent)

./deploy.sh patch    # Bump patch, tag, push (also: minor, major)
```

## Testing

`bun run test` runs **all** tests across every layer. Always use it. One command, nothing else needed.

Tests live at three layers:

| Layer | Location | Runner | Covers |
|-------|----------|--------|--------|
| Domain | `tests/domain.test.ts`, `tests/reminders-domain.test.ts` | bun:test | NoteService and ReminderService CRUD, validation, pagination |
| API | `tests/api.test.ts`, `tests/reminders-api.test.ts` | bun:test | Every HTTP endpoint, error responses |
| Web | `src/web/src/**/*.test.{ts,tsx}` | Vitest + jsdom | Hooks, components, routing, API client |

**Rules for contributors**:

- Every change that touches behavior must include or update tests at the appropriate layer. No exceptions.
- `bun run test` must pass before committing. If you break tests, fix them before moving on.
- Keep this file (`CLAUDE.md`) up to date. If you add modules, change structure, or introduce new patterns — update the docs here. This is the source of truth for how the project works.

## Architecture

Clean architecture with three transport layers sharing a common domain:

```
Web UI (React/Vite)  -+         NoteService     -> NoteRepository     -+
HTTP API (Hono)       -+---> {                                          }-> PostgreSQL
MCP Server            -+         ReminderService -> ReminderRepository -+
                                      |
                                EventBus -> WebSocket broadcast
```

**Domain layer** (`src/domain/`): Note and Reminder entities, NoteService, ReminderService, NoteRepository, ReminderRepository, EventBus. All business logic lives here. Services are wired through `AppContext` (DI container in `bootstrap.ts`).

**Server layer** (`src/server/`): Hono routes under `/api/notes` and `/api/reminders`, health check at `/api/health`, WebSocket at `/ws`, MCP at `/mcp`. Serves built web assets in production with SPA fallback.

**Web layer** (`src/web/`): React 19 SPA with NoteListPage and ReminderDashboardPage. Hooks encapsulate data fetching and business logic. Real-time updates via WebSocket subscription to domain events.

**MCP layer** (`src/mcp/`): 11 Model Context Protocol tools for AI client integration -- 5 note tools (list, get, create, update, delete) and 6 reminder tools (list, get, create, update, delete, dismiss). Tool schemas defined with Zod, handlers delegate to NoteService and ReminderService.

### Key Patterns

- **Dependency injection**: `AppContext` in `bootstrap.ts` creates and wires the NoteRepository, ReminderRepository, NoteService, ReminderService, and EventBus
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

Migrations in `src/domain/db/migrations/` run automatically on startup.

**Patch and minor releases**: migrations **must be backward compatible**. Users run older app versions against newer schemas during rolling upgrades. This means:

- **Add columns** with defaults or as nullable — never add NOT NULL without a default
- **Drop columns** only after the previous release no longer references them
- **Rename** via add-new → migrate-data → drop-old across releases, never in one step
- **Never drop tables** that the prior release still queries

**Major releases** may include breaking schema changes. When they do, include a data migration script at `scripts/migrate-to-vX.sh` (where X is the major version). This script must handle the full upgrade path from the previous major version. Document the migration steps in the release tag.

## Seed Data

`scripts/seed.ts` populates the dev database with realistic data covering every UI feature. It's idempotent — clears existing data before seeding.

**Keep this script up to date.** When you add entities or UI features, add corresponding seed data so `bun run seed` always produces a database that exercises every view.

Current coverage: notes (with/without context), reminders in every state (overdue, this week, next week, dormant) and every recurrence cadence (daily, weekly, monthly, yearly, one-shot).

## Versioning

Semver tracked in `package.json` (`version` field). Releases are git tags (`v0.1.0`, `v0.2.0`, etc.).

- **Patch** (`0.1.x`): bug fixes, no schema changes
- **Minor** (`0.x.0`): new features, backward-compatible migrations only
- **Major** (`x.0.0`): breaking changes — must ship with `scripts/migrate-to-vX.sh`

Deploy with `./deploy.sh [patch|minor|major]` — bumps version, commits, tags, and pushes.

## Tech Stack

- **Runtime**: Bun 1.3+ (see `.tool-versions`)
- **Backend**: Hono, PostgreSQL via `postgres` (porsager/postgres), migrations in `src/domain/db/migrations/`
- **Frontend**: React 19, Vite, TypeScript strict, @4lt7ab/ui component library
- **Validation**: Zod
- **IDs**: ULID
- **Testing**: `bun:test` (domain + API integration), Vitest + Testing Library + jsdom (web)
