# MCP Integration Guide

Connect AI clients like Claude Desktop and Claude Code to at-home so they can manage your notes through natural conversation.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that lets AI assistants call tools exposed by external servers. Instead of copy-pasting information between your notes app and an AI chat, MCP gives the AI direct access to create, read, update, and delete notes through structured tool calls.

---

## Connection Setup

at-home exposes its MCP server in two modes.

### Option 1: Standalone MCP Server (HTTP transport)

Run the MCP server as a standalone process. This is the simplest option for Claude Desktop and similar clients.

```bash
bun run start:mcp
```

This starts a Hono server on port 3101 (configurable via `HOME_MCP_PORT`) that accepts MCP requests over HTTP.

**Claude Desktop configuration** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "at-home": {
      "command": "bun",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/at-home"
    }
  }
}
```

### Option 2: Embedded MCP Endpoint (HTTP transport)

If at-home is already running (`bun run dev` or `bun run serve`), the MCP endpoint is available at `/mcp` on the same port (default 3100). No separate process needed.

**Claude Desktop configuration** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "at-home": {
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

**Note:** The embedded endpoint uses streamable HTTP transport with JSON responses (not SSE). Concurrent requests are serialized automatically.

---

## Available Tools

All 5 tools manage notes. Each tool returns JSON.

| Tool | Description |
|------|-------------|
| `list_notes` | List notes with optional title search. Returns paginated results. |
| `get_note` | Retrieve a single note by ID with full context. |
| `create_note` | Create one or more notes. Each requires a title; optional context. |
| `update_note` | Update one or more notes by ID. Only provided fields are changed (partial update). |
| `delete_notes` | Permanently delete notes by ID. |

---

## Common Workflows

These examples show natural requests and the MCP tools that fulfill them.

### "Show me all my notes"

Use `list_notes` with no filters. Results are paginated (default limit 50, max 200).

### "Find my notes about groceries"

Use `list_notes` with a title search:

```json
{ "title": "groceries" }
```

### "Create a note with my meeting notes"

Use `create_note`:

```json
{ "items": [{ "title": "Team standup - April 12", "context": "Discussed the Q2 roadmap..." }] }
```

### "Update my shopping list"

First find the note with `list_notes`, then use `update_note`:

```json
{ "items": [{ "id": "<note-id>", "context": "Updated list: milk, eggs, bread, coffee" }] }
```

### "Delete old notes"

Use `delete_notes` with the note IDs:

```json
{ "ids": ["<note-id-1>", "<note-id-2>"] }
```

---

## Tips

### Batch Operations

Create and update tools accept an `items` array, so you can create or update multiple notes in a single call:

```json
{
  "items": [
    { "title": "Grocery list", "context": "Milk, eggs, bread" },
    { "title": "Weekend plans", "context": "Hike on Saturday, brunch on Sunday" }
  ]
}
```

Delete accepts an `ids` array for the same purpose.

### Clearing Fields with Null

Update tools support setting fields to `null` to clear them. For example, to remove a note's context:

```json
{ "items": [{ "id": "<note-id>", "context": null }] }
```

Omitting a field leaves it unchanged; setting it to `null` explicitly clears it.

### Pagination

The `list_notes` tool returns `{ data: [...], total: number }`. Use `limit` and `offset` parameters to page through results. Default limit is 50, maximum is 200.
