import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  ServiceError,
  type INoteService,
  type IReminderService,
  type ILogService,
  type ILogEntryService,
  type NoteRepository,
  type LogRepository,
} from "../domain";

export interface McpServiceContext {
  noteService: INoteService;
  noteRepo: NoteRepository;
  reminderService: IReminderService;
  logService: ILogService;
  logEntryService: ILogEntryService;
  logRepo: LogRepository;
}

async function handle<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    if (err instanceof ServiceError) {
      return {
        content: [{ type: "text" as const, text: err.message }],
        isError: true,
      };
    }
    console.error(err);
    return {
      content: [{ type: "text" as const, text: "internal server error" }],
      isError: true,
    };
  }
}

/** Create an McpServer with note and reminder CRUD tools registered. */
export function createMcpServer(ctx: McpServiceContext): McpServer {
  const { noteService, reminderService, logService, logEntryService, logRepo } = ctx;

  const server = new McpServer({
    name: "at-home",
    version: "0.1.0",
  });

  // -- Note tools -------------------------------------------------------

  server.registerTool(
    "list_notes",
    {
      description: "List note summaries with optional filters. Returns { data, total } where data contains note summaries (id, title, has_context, timestamps).",
      inputSchema: {
        title: z.string().max(255).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ title, limit, offset }) =>
      handle(() => noteService.list({ title, limit, offset }))
  );

  server.registerTool(
    "get_note",
    {
      description: "Retrieve a single note by ID with full context.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => noteService.get(id))
  );

  server.registerTool(
    "create_note",
    {
      description: "Create notes. Pass an `items` array of objects, each with a required title. Optional context (markdown body).",
      inputSchema: {
        items: z.array(z.object({
          title: z.string().max(255),
          context: z.string().max(50000).optional(),
        })),
      },
    },
    ({ items }) => handle(() => noteService.create(items))
  );

  server.registerTool(
    "update_note",
    {
      description: "Update notes by ID. Pass an `items` array with required id. Only provided fields are changed.",
      inputSchema: {
        items: z.array(z.object({
          id: z.string().max(26),
          title: z.string().max(255).optional(),
          context: z.string().max(50000).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => noteService.update(items))
  );

  server.registerTool(
    "delete_notes",
    {
      description: "Permanently delete notes by ID. This is destructive and cannot be undone. Pass an `ids` array of note ID strings.",
      inputSchema: {
        ids: z.array(z.string().max(26)),
      },
    },
    ({ ids }) => handle(async () => { const deleted = await noteService.remove(ids); return { deleted }; })
  );

  // -- Reminder tools ---------------------------------------------------

  server.registerTool(
    "list_reminders",
    {
      description: "List reminder summaries with optional filters. Returns { data, total } where data contains reminder summaries (id, context, context_preview, remind_at, recurrence, is_active, timestamps).",
      inputSchema: {
        context: z.string().max(255).optional(),
        remind_at_from: z.string().optional(),
        remind_at_to: z.string().optional(),
        status: z.enum(["active", "dormant"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ context, remind_at_from, remind_at_to, status, limit, offset }) =>
      handle(() => reminderService.list({ context, remind_at_from, remind_at_to, status, limit, offset }))
  );

  server.registerTool(
    "get_reminder",
    {
      description: "Retrieve a single reminder by ID with full context.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => reminderService.get(id))
  );

  server.registerTool(
    "create_reminder",
    {
      description: "Create reminders. Pass an `items` array of objects, each with required context and remind_at. Optional recurrence (weekly, monthly, yearly).",
      inputSchema: {
        items: z.array(z.object({
          context: z.string().max(50000),
          remind_at: z.string(),
          recurrence: z.enum(["weekly", "biweekly", "monthly", "yearly"]).optional(),
        })),
      },
    },
    ({ items }) => handle(() => reminderService.create(items))
  );

  server.registerTool(
    "update_reminder",
    {
      description: "Update reminders by ID. Pass an `items` array with required id. Only provided fields are changed.",
      inputSchema: {
        items: z.array(z.object({
          id: z.string().max(26),
          context: z.string().max(50000).optional(),
          remind_at: z.string().optional(),
          recurrence: z.enum(["weekly", "biweekly", "monthly", "yearly"]).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => reminderService.update(items))
  );

  server.registerTool(
    "delete_reminders",
    {
      description: "Permanently delete reminders by ID. This is destructive and cannot be undone. Pass an `ids` array of reminder ID strings.",
      inputSchema: {
        ids: z.array(z.string().max(26)),
      },
    },
    ({ ids }) => handle(async () => { const deleted = await reminderService.remove(ids); return { deleted }; })
  );

  server.registerTool(
    "dismiss_reminder",
    {
      description: "Dismiss a reminder by ID. For recurring reminders, this marks the current occurrence as handled and advances to the next. Optionally override the next remind_at.",
      inputSchema: {
        id: z.string().max(26),
        remind_at: z.string().optional(),
      },
    },
    ({ id, remind_at }) => handle(() => reminderService.dismiss({ id, remind_at }))
  );

  // -- Log tools --------------------------------------------------------

  server.registerTool(
    "list_logs",
    {
      description: "List log definitions. Each summary includes last_logged_at and entry_count projections.",
      inputSchema: {
        name: z.string().max(255).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ name, limit, offset }) => handle(() => logService.list({ name, limit, offset })),
  );

  server.registerTool(
    "get_log",
    {
      description: "Retrieve a single log definition by ID.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => logService.get(id)),
  );

  server.registerTool(
    "create_log",
    {
      description: "Create log definitions. Pass an `items` array; each needs a name. Optional description.",
      inputSchema: {
        items: z.array(z.object({
          name: z.string().max(255),
          description: z.string().max(50000).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => logService.create(items)),
  );

  server.registerTool(
    "update_log",
    {
      description: "Update log definitions by ID. Pass an `items` array with required id.",
      inputSchema: {
        items: z.array(z.object({
          id: z.string().max(26),
          name: z.string().max(255).optional(),
          description: z.string().max(50000).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => logService.update(items)),
  );

  server.registerTool(
    "delete_logs",
    {
      description: "Permanently delete log definitions by ID. Cascades to all entries. Destructive.",
      inputSchema: { ids: z.array(z.string().max(26)) },
    },
    ({ ids }) => handle(async () => { const deleted = await logService.remove(ids); return { deleted }; }),
  );

  server.registerTool(
    "list_log_entries",
    {
      description: "List log entries, ordered by occurred_at DESC. Filter by log_id and/or occurred_at range.",
      inputSchema: {
        log_id: z.string().max(26).optional(),
        occurred_at_from: z.string().optional(),
        occurred_at_to: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ log_id, occurred_at_from, occurred_at_to, limit, offset }) =>
      handle(() => logEntryService.list({ log_id, occurred_at_from, occurred_at_to, limit, offset })),
  );

  server.registerTool(
    "get_log_entry",
    {
      description: "Retrieve a single log entry by ID, scoped to its parent log. Returns 404 if the entry doesn't belong to the given log_id.",
      inputSchema: {
        log_id: z.string().max(26),
        id: z.string().max(26),
      },
    },
    ({ log_id, id }) => handle(async () => {
      const entry = await logEntryService.get(id);
      if (entry.log_id !== log_id) {
        throw new ServiceError("log entry not found under this log", 404);
      }
      return entry;
    }),
  );

  server.registerTool(
    "create_log_entry",
    {
      description: "Create log entries. Pass an `items` array; each needs log_id. occurred_at defaults to now. note and metadata (freeform JSON object) optional.",
      inputSchema: {
        items: z.array(z.object({
          log_id: z.string().max(26),
          occurred_at: z.string().optional(),
          note: z.string().max(50000).optional().nullable(),
          metadata: z.record(z.string(), z.any()).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => logEntryService.create(items)),
  );

  server.registerTool(
    "update_log_entry",
    {
      description: "Update log entries scoped to a single parent log. Pass log_id plus an `items` array. Every id in items must belong to log_id or the call 404s.",
      inputSchema: {
        log_id: z.string().max(26),
        items: z.array(z.object({
          id: z.string().max(26),
          occurred_at: z.string().optional(),
          note: z.string().max(50000).optional().nullable(),
          metadata: z.record(z.string(), z.any()).optional().nullable(),
        })),
      },
    },
    ({ log_id, items }) => handle(async () => {
      for (const item of items) {
        const existing = await logEntryService.get(item.id).catch(() => null);
        if (!existing || existing.log_id !== log_id) {
          throw new ServiceError(`log entry not found under this log: ${item.id}`, 404);
        }
      }
      return await logEntryService.update(items);
    }),
  );

  server.registerTool(
    "delete_log_entries",
    {
      description: "Permanently delete log entries scoped to a single parent log. Pass log_id plus an `ids` array. Every id must belong to log_id or the call 404s. Destructive.",
      inputSchema: {
        log_id: z.string().max(26),
        ids: z.array(z.string().max(26)),
      },
    },
    ({ log_id, ids }) => handle(async () => {
      for (const id of ids) {
        const existing = await logEntryService.get(id).catch(() => null);
        if (!existing || existing.log_id !== log_id) {
          throw new ServiceError(`log entry not found under this log: ${id}`, 404);
        }
      }
      const deleted = await logEntryService.remove(ids);
      return { deleted };
    }),
  );

  server.registerTool(
    "log_entry",
    {
      description: "Convenience verb: record that something happened. Resolves log_name to a Log (case-insensitive exact, then ILIKE). occurred_at defaults to now. Ambiguous matches return a list of candidates.",
      inputSchema: {
        log_name: z.string().max(255),
        occurred_at: z.string().optional(),
        note: z.string().max(50000).optional().nullable(),
        metadata: z.record(z.string(), z.any()).optional().nullable(),
      },
    },
    ({ log_name, occurred_at, note, metadata }) => handle(async () => {
      const name = log_name.trim();
      if (!name) throw new ServiceError("log_name is required", 400);

      let matches = await logRepo.findByNameExact(name);
      if (matches.length === 0) {
        matches = await logRepo.findByNameLike(name);
      }
      if (matches.length === 0) {
        throw new ServiceError(`no log matches "${log_name}"`, 404);
      }
      if (matches.length > 1) {
        const candidates = matches.map((l) => l.name).join(", ");
        throw new ServiceError(`ambiguous log_name "${log_name}". Candidates: ${candidates}`, 400);
      }
      const [log] = matches;
      const [entry] = await logEntryService.create([{
        log_id: log.id,
        occurred_at,
        note: note ?? null,
        metadata: metadata ?? null,
      }]);
      return entry;
    }),
  );

  return server;
}

/**
 * Create a stateless HTTP handler that reuses a single McpServer instance.
 */
export function createMcpHttpHandler(ctx: McpServiceContext): (req: Request) => Promise<Response> {
  const server = createMcpServer(ctx);
  let pending: Promise<unknown> = Promise.resolve();

  return (req: Request): Promise<Response> => {
    const result = pending.then(async () => {
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      try {
        await server.connect(transport);
        const response = await transport.handleRequest(req);
        return response;
      } finally {
        await server.close();
      }
    });
    pending = result.catch(() => {});
    return result;
  };
}
