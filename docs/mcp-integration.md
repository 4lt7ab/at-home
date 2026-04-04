# MCP Integration Guide

Connect AI clients like Claude Desktop and Claude Code to tab-at-home so they can manage your home tasks, notes, and schedules through natural conversation.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that lets AI assistants call tools exposed by external servers. Instead of copy-pasting information between your task manager and an AI chat, MCP gives the AI direct access to create tasks, check schedules, mark things complete, and more -- all through structured tool calls that the tab-at-home server handles safely.

---

## Connection Setup

tab-at-home exposes its MCP server in two modes. Choose whichever fits your setup.

### Option 1: Standalone MCP Server (HTTP transport)

Run the MCP server as a standalone process. This is the simplest option for Claude Desktop and similar clients that manage their own server processes.

```bash
bun run start:mcp
```

This starts a Hono server on port 3101 (configurable via `HOME_MCP_PORT`) that accepts MCP requests over HTTP. The database path defaults to `.local/data/sqlite.db` relative to the project root.

**Claude Desktop configuration** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tab-at-home": {
      "command": "bun",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/tab-at-home"
    }
  }
}
```

### Option 2: Embedded MCP Endpoint (HTTP transport)

If tab-at-home is already running as a full server (`bun run dev` or `bun run serve`), the MCP endpoint is available at `/mcp` on the same port (default 3100). No separate process needed.

**Claude Desktop configuration** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tab-at-home": {
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

**Note:** The embedded endpoint uses streamable HTTP transport with JSON responses (not SSE). Concurrent requests are serialized automatically -- the server queues them rather than rejecting them.

---

## Available Tools

All 17 tools are organized below by entity type. Each tool returns JSON. For full input schemas and response shapes, see the [MCP Tools and HTTP API Reference](./api-reference.md) or the tool descriptions exposed by the server itself.

### HomeTask Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | List task summaries with optional filters (status, area, effort, title search). Returns paginated results. |
| `get_task` | Retrieve a single task by ID with all fields including full description. |
| `create_task` | Create one or more tasks. Each requires a title; optional description, status, area, and effort. |
| `update_task` | Update one or more tasks by ID. Only provided fields are changed (partial update). |
| `delete_tasks` | Permanently delete tasks by ID. Cascades to linked schedules. |

### Note Tools

| Tool | Description |
|------|-------------|
| `list_notes` | List note summaries with optional filters (task_id, title search). Returns paginated results. |
| `get_note` | Retrieve a single note by ID with full markdown content. |
| `create_note` | Create one or more notes. Each requires a title; optional content (markdown) and task_id to link to a task. |
| `update_note` | Update one or more notes by ID. Only provided fields are changed. |
| `delete_notes` | Permanently delete notes by ID. |

### Schedule Tools

| Tool | Description |
|------|-------------|
| `list_schedules` | List schedule summaries with optional filters (task_id, recurrence_type). Returns paginated results. |
| `get_schedule` | Retrieve a single schedule by ID with full recurrence rule. |
| `create_schedule` | Create one or more schedules. Each requires task_id and recurrence_type (once/daily/weekly/monthly/seasonal/custom). Optional recurrence_rule and next_due date. |
| `update_schedule` | Update one or more schedules by ID. Only provided fields are changed. |
| `delete_schedules` | Permanently delete schedules by ID. |

### Composite Tools

| Tool | Description |
|------|-------------|
| `get_daily_summary` | Get today's actionable overview: overdue items, due today, and upcoming items within a lookahead window (default 7 days, max 90). Includes task details, schedule info, linked notes, and human-readable recurrence labels. |
| `complete_task` | Mark a task occurrence as done. For one-off tasks, sets status to done. For recurring tasks, advances the schedule to the next due date without changing task status. Optionally creates a completion note. |

---

## Common Workflows

These examples show natural requests and the MCP tools that fulfill them.

### "What's on my plate today?"

Use `get_daily_summary` with no arguments. It returns three lists:

- **overdue** -- tasks past their due date, with `days_overdue` count
- **due_today** -- tasks due right now
- **upcoming** -- tasks due within the next 7 days

Each item includes the task summary, schedule details, any linked notes, and a human-readable recurrence label like "every 2 weeks".

### "What's overdue?"

Same tool: `get_daily_summary`. Check the `overdue` array in the response and the `counts.overdue` field for a quick count.

### "Create a new weekly task"

This takes two tool calls:

1. `create_task` -- create the task itself:
   ```json
   { "items": [{ "title": "Vacuum the living room", "area": "living_room", "effort": "low" }] }
   ```
2. `create_schedule` -- attach a weekly schedule to it:
   ```json
   { "items": [{ "task_id": "<id from step 1>", "recurrence_type": "weekly", "next_due": "2026-04-05" }] }
   ```

### "Mark the kitchen cleaning done"

Use `complete_task` with the task's ID. Optionally include a note:

```json
{ "task_id": "<task-id>", "note": "Deep cleaned behind the fridge" }
```

For recurring tasks, this advances the schedule to the next due date and keeps the task active. For one-off tasks (no schedule or `once` schedule), the task status is set to `done`.

If a note is provided, a linked note is automatically created with the title "Completed: {task title}".

### "Show me all my notes"

Use `list_notes` with no filters. To see notes for a specific task, pass `task_id`. Results are paginated (default limit 50, max 200).

---

## Tips

### Batch Operations

All create and update tools accept an `items` array, so you can create or update multiple entities in a single call:

```json
{
  "items": [
    { "title": "Clean gutters", "area": "exterior" },
    { "title": "Replace furnace filter", "area": "hvac" }
  ]
}
```

Delete tools accept an `ids` array for the same purpose.

### Recurring vs. One-Off Completion

When you call `complete_task`:

- **No schedule or `once` schedule:** The task status changes to `done`. It will not appear in future daily summaries.
- **Recurring schedule (daily, weekly, monthly, seasonal, custom):** The task status stays `active`. Only the schedule advances to the next due date. The task keeps appearing on its new schedule.

### Clearing Fields with Null

Update tools support setting fields to `null` to clear them. For example, to remove a task's description:

```json
{ "items": [{ "id": "<task-id>", "description": null }] }
```

This works for `description`, `area`, and `effort` on tasks; `content` and `task_id` on notes; and `recurrence_rule`, `next_due`, and `last_completed` on schedules. Omitting a field leaves it unchanged; setting it to `null` explicitly clears it.

### Available Filter Values

When filtering, use these enum values:

- **Task status:** `active`, `paused`, `done`, `archived`
- **Area:** `kitchen`, `bathroom`, `bedroom`, `living_room`, `garage`, `yard`, `basement`, `attic`, `office`, `exterior`, `hvac`, `plumbing`, `electrical`, `general`
- **Effort:** `trivial`, `low`, `medium`, `high`
- **Recurrence type:** `once`, `daily`, `weekly`, `monthly`, `seasonal`, `custom`

### Pagination

All list tools return `{ data: [...], total: number }`. Use `limit` and `offset` parameters to page through results. Default limit is 50, maximum is 200.
