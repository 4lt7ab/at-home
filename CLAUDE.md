# 4lt7ab/at-home

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

at-home -- a notes, reminders, and logs app with real-time updates. Bun + Hono backend, React frontend, PostgreSQL database, MCP integration.

**Reminders vs Logs — the split is load-bearing.** Reminders are future-looking: they nag until dismissed, support recurrence, and live on a timeline. Logs are past-facts only: timestamped records of things that happened, no intervals, no recurrence, no nagging. The two features never share logic. If a requirement looks like it straddles both, it belongs in one or the other — pick.

**Reactions — fixed palette, counts never decrement.** Log entries support emoji reactions from a fixed 9-emoji palette: ❤️ 👍 🎉 🔥 ✅ 🤔 🦖 🫠 🪄. Adding a reaction increments its count; there is no un-react, no decrement, no DELETE endpoint. The palette is closed — attempting to add an off-palette emoji returns 400. Reactions are a projection of LogEntry (computed on read), not an independent entity surfaced in the UI outside the context of its parent entry. The palette and `PALETTE_SET` are exported from `src/domain/services/log-entries.ts` as the single source of truth.

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
| Domain | `tests/domain.test.ts`, `tests/reminders-domain.test.ts`, `tests/logs-domain.test.ts` | bun:test | NoteService, ReminderService, LogService, LogEntryService — CRUD, validation, pagination, projections, cascade delete |
| API | `tests/api.test.ts`, `tests/reminders-api.test.ts`, `tests/logs-api.test.ts` | bun:test | Every HTTP endpoint, error responses |
| Web | `src/web/src/**/*.test.{ts,tsx}` | Vitest + jsdom | Hooks, components, routing, API client |

**Rules for contributors**:

- Every change that touches behavior must include or update tests at the appropriate layer. No exceptions.
- `bun run test` must pass before committing. If you break tests, fix them before moving on.
- Keep this file (`CLAUDE.md`) up to date. If you add modules, change structure, or introduce new patterns — update the docs here. This is the source of truth for how the project works.

## Architecture

Clean architecture with three transport layers sharing a common domain:

```
Web UI (React/Vite)  -+         NoteService     -> NoteRepository              -+
HTTP API (Hono)       -+---> {  ReminderService -> ReminderRepository            }-> PostgreSQL
MCP Server            -+        LogService      -> LogRepository                -+
                                 LogEntryService -> LogEntryRepository           |
                                                 -> LogEntryReactionRepository  |
                                      |
                                EventBus -> WebSocket broadcast
```

**Domain layer** (`src/domain/`): Note, Reminder, Log, and LogEntry entities with matching services and repositories. All business logic lives here. Services are wired through `AppContext` (DI container in `bootstrap.ts`). Naming is strict: code and UI both use `Log` (the definition) and `LogEntry` (one instance). No "Event" naming — that's already taken by `DomainEvent` on the EventBus.

- `Log`: a named definition (`name`, `description`). LogSummary adds `last_logged_at` and `entry_count` projections computed on read.
- `LogEntry`: one occurrence with `log_id`, `occurred_at` (backdatable), optional `note`, freeform JSONB `metadata`. Cascade-deletes with its parent Log. `LogEntrySummary` adds a `reactions: LogEntryReaction[]` projection (one row per emoji with a `count`), computed on read by `LogEntryReactionRepository.projectionsForIds`. Reactions have no standalone entity in the UI — they're only surfaced through their parent entry — and counts are monotonically increasing: `LogEntryService.applyReaction` upserts + increments, never decrements. Rows cascade-delete with the parent entry (which cascades with its parent Log).

**Server layer** (`src/server/`): Hono routes under `/api/notes`, `/api/reminders`, `/api/logs` (entries fully nested under `/api/logs/:log_id/entries` — batch POST/PATCH/DELETE on the collection URL, single-entry GET/PATCH/DELETE on `/api/logs/:log_id/entries/:entry_id`; any entry whose parent log doesn't match `:log_id` returns 404). Reactions are `POST /api/logs/:log_id/entries/:entry_id/reactions` only — no GET, PATCH, or DELETE; the response is the updated `LogEntrySummary` with fresh `reactions`. Health check at `/api/health`, WebSocket at `/ws`, MCP at `/mcp`. Serves built web assets in production with SPA fallback.

**Web layer** (`src/web/`): React 19 SPA with NoteListPage, ReminderDashboardPage, and LogsPage. Hooks encapsulate data fetching and business logic. Real-time updates via WebSocket subscription to domain events — `useLogs` subscribes to both `log` and `log_entry` so projections stay fresh. The `<ReactionStrip>` component (`src/web/src/components/ReactionStrip.tsx`) renders inline under each log entry on LogsPage, applies reactions optimistically, and reconciles against WebSocket-driven refetches.

**MCP layer** (`src/mcp/`): 23 Model Context Protocol tools for AI client integration --
- 5 note tools: list, get, create, update, delete
- 6 reminder tools: list, get, create, update, delete, dismiss
- 12 log tools: list_logs, get_log, create_log, update_log, delete_logs, list_log_entries, get_log_entry, create_log_entry, update_log_entry, delete_log_entries, `log_entry` — the convenience verb that resolves `log_name` via case-insensitive exact match then ILIKE, defaults occurred_at to now, and returns a helpful "Candidates: …" error on ambiguous matches — and `add_log_entry_reaction`, which increments the count for a `(log_entry_id, emoji)` pair from the fixed palette.
Tool schemas defined with Zod, handlers delegate to the services.

### Key Patterns

- **Dependency injection**: `AppContext` in `bootstrap.ts` creates and wires every repository and service (Note, Reminder, Log, LogEntry, LogEntryReaction) plus the EventBus
- **Domain events**: `EventBus` pub-sub for real-time WebSocket broadcast on mutations. `entity_type` is one of `note | reminder | log | log_entry`. Reactions do not get their own entity type — `applyReaction` emits a `log_entry` `updated` event so listeners refetch the parent entry with fresh reactions.
- **Projections computed on read**: `LogSummary.last_logged_at` and `entry_count` are computed by `LogRepository.projectionsForIds`; `LogEntrySummary.reactions` is computed by `LogEntryReactionRepository.projectionsForIds`. Both at list time — no denormalized counters to keep in sync.
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

Current coverage: notes (with/without context), reminders in every state (overdue, this week, next week, dormant) and every recurrence cadence (daily, weekly, monthly, yearly, one-shot), and logs with every render case — empty (no entries yet), frequent entries, sparse history, entries with notes, entries with metadata, long-note entries, and entries with reactions (both single-emoji and multi-emoji with varied counts) alongside entries with no reactions.

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
