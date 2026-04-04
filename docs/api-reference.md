# HTTP API Reference

Base URL: `http://localhost:3100/api`

Authentication: none (local app).

All request/response bodies are JSON. All IDs are ULID strings (26 chars max).

---

## Tasks

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/tasks` | List tasks (summaries) | 200 |
| GET | `/api/tasks/:id` | Get full task | 200 |
| POST | `/api/tasks` | Create tasks | 201 |
| PATCH | `/api/tasks` | Update tasks | 200 |
| DELETE | `/api/tasks` | Delete tasks | 204 |

**GET /api/tasks** query params:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | -- | Comma-separated. Values: `active`, `paused`, `done`, `archived` |
| `area` | string | -- | One of: `kitchen`, `bathroom`, `bedroom`, `living_room`, `garage`, `yard`, `basement`, `attic`, `office`, `exterior`, `hvac`, `plumbing`, `electrical`, `general` |
| `effort` | string | -- | One of: `trivial`, `low`, `medium`, `high` |
| `title` | string | -- | Substring search (LIKE) |
| `limit` | int | 50 | Max 200 |
| `offset` | int | 0 | |

Response: `{ data: HomeTaskSummary[], total: number }`

```jsonc
// HomeTaskSummary
{ "id", "title", "status", "area", "effort", "has_description", "created_at", "updated_at" }
```

**GET /api/tasks/:id** response (full entity):

```jsonc
{ "id", "title", "description", "status", "area", "effort", "created_at", "updated_at" }
```

**POST /api/tasks** body:

```json
{ "items": [{ "title": "Clean gutters", "area": "exterior", "effort": "medium" }] }
```

Fields: `title` (required, max 255), `description?` (max 10000), `status?` (default `active`), `area?`, `effort?`.

Response: full `HomeTask[]`.

**PATCH /api/tasks** body:

```json
{ "items": [{ "id": "01ABC...", "status": "paused" }] }
```

Only provided fields are changed. `description`, `area`, `effort` accept `null` to clear.

Response: full `HomeTask[]`.

**DELETE /api/tasks** body:

```json
{ "ids": ["01ABC...", "01DEF..."] }
```

Response: empty body, 204.

---

## Notes

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/notes` | List notes (summaries) | 200 |
| GET | `/api/notes/:id` | Get full note | 200 |
| POST | `/api/notes` | Create notes | 201 |
| PATCH | `/api/notes` | Update notes | 200 |
| DELETE | `/api/notes` | Delete notes | 204 |

**GET /api/notes** query params:

| Param | Type | Default |
|-------|------|---------|
| `task_id` | string | -- |
| `title` | string | -- |
| `limit` | int | 50 (max 200) |
| `offset` | int | 0 |

Response: `{ data: NoteSummary[], total: number }`

```jsonc
// NoteSummary
{ "id", "task_id", "title", "has_content", "created_at", "updated_at" }

// Full Note (GET /api/notes/:id)
{ "id", "task_id", "title", "content", "created_at", "updated_at" }
```

**POST /api/notes** body:

```json
{ "items": [{ "title": "Repair log", "content": "Replaced washer", "task_id": "01ABC..." }] }
```

Fields: `title` (required, max 255), `content?` (max 50000, markdown), `task_id?`.

**PATCH /api/notes** body:

```json
{ "items": [{ "id": "01ABC...", "content": null }] }
```

`content` and `task_id` accept `null` to clear.

**DELETE /api/notes** body: `{ "ids": ["01ABC..."] }` -- 204 empty.

---

## Schedules

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/schedules` | List schedules (summaries) | 200 |
| GET | `/api/schedules/:id` | Get full schedule | 200 |
| POST | `/api/schedules` | Create schedules | 201 |
| PATCH | `/api/schedules` | Update schedules | 200 |
| DELETE | `/api/schedules` | Delete schedules | 204 |

**GET /api/schedules** query params:

| Param | Type | Default |
|-------|------|---------|
| `task_id` | string | -- |
| `recurrence_type` | string | -- |
| `limit` | int | 50 (max 200) |
| `offset` | int | 0 |

Recurrence types: `once`, `daily`, `weekly`, `monthly`, `seasonal`, `custom`.

Response: `{ data: ScheduleSummary[], total: number }`

```jsonc
// ScheduleSummary
{ "id", "task_id", "recurrence_type", "next_due", "last_completed", "created_at", "updated_at" }

// Full Schedule (GET /api/schedules/:id)
{ "id", "task_id", "recurrence_type", "recurrence_rule", "next_due", "last_completed", "created_at", "updated_at" }
```

**POST /api/schedules** body:

```json
{ "items": [{ "task_id": "01ABC...", "recurrence_type": "weekly", "next_due": "2026-04-10" }] }
```

Fields: `task_id` (required), `recurrence_type` (required), `recurrence_rule?` (max 500), `next_due?` (YYYY-MM-DD).

**PATCH /api/schedules** body:

```json
{ "items": [{ "id": "01ABC...", "next_due": "2026-05-01" }] }
```

`recurrence_rule`, `next_due`, `last_completed` accept `null` to clear.

**DELETE /api/schedules** body: `{ "ids": ["01ABC..."] }` -- 204 empty.

---

## Daily Summary

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/summary` | Get daily summary | 200 |
| POST | `/api/summary/complete` | Complete a task | 200 |

**GET /api/summary** query params:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `date` | string | today | YYYY-MM-DD |
| `lookahead_days` | int | 7 | Clamped to max 90 |

Response:

```jsonc
{
  "date": "2026-04-03",
  "overdue": [/* DailySummaryItem[] */],
  "due_today": [/* DailySummaryItem[] */],
  "upcoming": [/* DailySummaryItem[] */],
  "counts": { "overdue": 2, "due_today": 1, "upcoming": 5, "total": 8 }
}
```

Each `DailySummaryItem`:

```jsonc
{
  "task": { /* HomeTaskSummary */ },
  "schedule": { /* ScheduleSummary */ },
  "notes": [/* NoteSummary[] */],
  "days_overdue": 3,
  "recurrence_label": "every 2 weeks"
}
```

**POST /api/summary/complete** body:

```json
{ "task_id": "01ABC...", "note": "Cleaned and inspected" }
```

`note` is optional. Only `active` tasks can be completed (400 for `done`/`paused`/`archived`).

Response:

```jsonc
{
  "task": { /* HomeTask */ },
  "schedule": { /* Schedule or null */ },
  "next_due": "2026-04-10",
  "completed_at": "2026-04-03T14:30:00.000Z",
  "note_created": { /* Note or null */ }
}
```

Behavior: recurring tasks stay `active` with schedule advanced to next due date. One-off and unscheduled tasks are set to `done`.

---

## Activity Log

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/activity-log` | List activity entries | 200 |

**GET /api/activity-log** query params:

| Param | Type | Default |
|-------|------|---------|
| `entity_type` | string | -- |
| `entity_id` | string | -- |
| `limit` | int | 50 (max 200) |
| `offset` | int | 0 |

Entity types: `home_task`, `note`, `schedule`. Actions: `created`, `updated`, `deleted`, `completed`.

Response: `{ data: ActivityLog[], total: number }`

```jsonc
{ "id", "entity_type", "entity_id", "action", "summary", "created_at" }
```

---

## Health Check

**GET /api/health**

```jsonc
{
  "status": "ok",           // "ok" | "degraded"
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "database": "connected",  // "connected" | "unreachable"
  "timestamp": "2026-04-03T14:30:00.000Z"
}
```

---

## WebSocket

Endpoint: `ws://localhost:3100/ws`

Server-to-client broadcast only. Client messages are ignored.

Event shapes:

```jsonc
// Entity created or updated
{ "type": "created", "entity_type": "home_task", "payload": { /* full entity */ } }
{ "type": "updated", "entity_type": "note", "payload": { /* full entity */ } }

// Entity deleted
{ "type": "deleted", "entity_type": "schedule", "ids": ["01ABC..."] }
```

Entity types: `home_task`, `note`, `schedule`.

---

## Common Patterns

**Batch operations.** Create and update routes always take `{ items: T[] }`. Delete routes always take `{ ids: string[] }`. Single-item operations use the same shape with a one-element array.

**Pagination.** All list endpoints return `{ data: T[], total: number }`. Use `limit` and `offset` query params. Default limit is 50, max is 200. `total` reflects the filtered count for pagination math.

**Summary vs full types.** List endpoints return lightweight summaries (e.g., `has_description` boolean instead of the full text). Use `GET /:id` for the complete entity.

**Timestamps.** `created_at` and `updated_at` are ISO 8601 strings. Date-only fields (`next_due`, `last_completed`) use `YYYY-MM-DD`.

---

## Errors

All errors return `{ "error": "message" }` with an appropriate status code.

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing fields, invalid enum values, invalid JSON) |
| 404 | Entity not found |
| 409 | Conflict |
| 500 | Internal server error |

---

## curl Examples

**List active tasks:**

```bash
curl http://localhost:3100/api/tasks?status=active&limit=10
```

**Create a task:**

```bash
curl -X POST http://localhost:3100/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"items": [{"title": "Clean gutters", "area": "exterior", "effort": "medium"}]}'
```

**Complete a task:**

```bash
curl -X POST http://localhost:3100/api/summary/complete \
  -H 'Content-Type: application/json' \
  -d '{"task_id": "01JWAB1234EXAMPLE56789", "note": "Done, no issues found"}'
```

**Get daily summary:**

```bash
curl 'http://localhost:3100/api/summary?date=2026-04-03&lookahead_days=14'
```
