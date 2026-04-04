import type { Database } from "bun:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  ServiceError,
  TASK_STATUSES,
  AREAS,
  EFFORT_LEVELS,
  RECURRENCE_TYPES,
  NOTE_TYPES,
  type IHomeTaskService,
  type INoteService,
  type IScheduleService,
  type HomeTaskRepository,
  type NoteRepository,
  type ScheduleRepository,
  type ActivityLogRepository,
  buildDailySummary,
} from "../domain";
import type { EventBus } from "../domain/events";
import { completeTask } from "../domain/operations/complete-task";

export interface McpServiceContext {
  db: Database;
  eventBus: EventBus;
  homeTaskService: IHomeTaskService;
  noteService: INoteService;
  scheduleService: IScheduleService;
  homeTaskRepo: HomeTaskRepository;
  noteRepo: NoteRepository;
  scheduleRepo: ScheduleRepository;
  activityLogRepo: ActivityLogRepository;
}

function handle<T>(fn: () => T) {
  try {
    const result = fn();
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

/** Create an McpServer with all CRUD tools registered. */
export function createMcpServer(ctx: McpServiceContext): McpServer {
  const { homeTaskService, noteService, scheduleService, homeTaskRepo, noteRepo, scheduleRepo } = ctx;

  const server = new McpServer({
    name: "tab-at-home",
    version: "0.1.0",
  });

  // -- HomeTask tools ---------------------------------------------------

  server.registerTool(
    "list_tasks",
    {
      description: "List home task summaries with optional filters. Returns { data, total } where data contains task summaries (id, title, status, area, effort, has_description, timestamps).",
      inputSchema: {
        status: z.enum([...TASK_STATUSES]).optional(),
        area: z.enum([...AREAS]).optional(),
        effort: z.enum([...EFFORT_LEVELS]).optional(),
        title: z.string().max(255).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ status, area, effort, title, limit, offset }) =>
      handle(() => homeTaskService.list({ status, area, effort, title, limit, offset }))
  );

  server.registerTool(
    "get_task",
    {
      description: "Retrieve a single home task by ID with all fields.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => homeTaskService.get(id))
  );

  server.registerTool(
    "create_task",
    {
      description: "Create home tasks. Pass an `items` array of objects, each with a required title. Optional description, status (active/paused/done/archived, defaults to active), area, and effort.",
      inputSchema: {
        items: z.array(z.object({
          title: z.string().max(255),
          description: z.string().max(10000).optional(),
          status: z.enum([...TASK_STATUSES]).optional(),
          area: z.enum([...AREAS]).optional(),
          effort: z.enum([...EFFORT_LEVELS]).optional(),
        })),
      },
    },
    ({ items }) => handle(() => homeTaskService.create(items))
  );

  server.registerTool(
    "update_task",
    {
      description: "Update home tasks by ID. Pass an `items` array with required id. Only provided fields are changed.",
      inputSchema: {
        items: z.array(z.object({
          id: z.string().max(26),
          title: z.string().max(255).optional(),
          description: z.string().max(10000).optional().nullable(),
          status: z.enum([...TASK_STATUSES]).optional(),
          area: z.enum([...AREAS]).optional().nullable(),
          effort: z.enum([...EFFORT_LEVELS]).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => homeTaskService.update(items))
  );

  server.registerTool(
    "delete_tasks",
    {
      description: "Permanently delete home tasks by ID. This is destructive and cannot be undone. Pass an `ids` array of task ID strings.",
      inputSchema: {
        ids: z.array(z.string().max(26)),
      },
    },
    ({ ids }) => handle(() => { const deleted = homeTaskService.remove(ids); return { deleted }; })
  );

  // -- Note tools -------------------------------------------------------

  server.registerTool(
    "list_notes",
    {
      description: "List note summaries with optional filters. Returns { data, total } where data contains note summaries (id, task_id, title, has_content, note_type, timestamps).",
      inputSchema: {
        task_id: z.string().max(26).optional(),
        title: z.string().max(255).optional(),
        note_type: z.enum([...NOTE_TYPES]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ task_id, title, note_type, limit, offset }) =>
      handle(() => noteService.list({ task_id, title, note_type, limit, offset }))
  );

  server.registerTool(
    "get_note",
    {
      description: "Retrieve a single note by ID with full content.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => noteService.get(id))
  );

  server.registerTool(
    "create_note",
    {
      description: "Create notes. Pass an `items` array of objects, each with a required title. Optional content (markdown), task_id to link to a home task, and note_type (manual/completion, defaults to manual).",
      inputSchema: {
        items: z.array(z.object({
          title: z.string().max(255),
          content: z.string().max(50000).optional(),
          task_id: z.string().max(26).optional(),
          note_type: z.enum([...NOTE_TYPES]).optional(),
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
          content: z.string().max(50000).optional().nullable(),
          task_id: z.string().max(26).optional().nullable(),
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
    ({ ids }) => handle(() => { const deleted = noteService.remove(ids); return { deleted }; })
  );

  // -- Schedule tools ---------------------------------------------------

  server.registerTool(
    "list_schedules",
    {
      description: "List schedule summaries with optional filters. Returns { data, total } where data contains schedule summaries (id, task_id, recurrence_type, next_due, last_completed, timestamps).",
      inputSchema: {
        task_id: z.string().max(26).optional(),
        recurrence_type: z.enum([...RECURRENCE_TYPES]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ task_id, recurrence_type, limit, offset }) =>
      handle(() => scheduleService.list({ task_id, recurrence_type, limit, offset }))
  );

  server.registerTool(
    "get_schedule",
    {
      description: "Retrieve a single schedule by ID with all fields.",
      inputSchema: { id: z.string().max(26) },
    },
    ({ id }) => handle(() => scheduleService.get(id))
  );

  server.registerTool(
    "create_schedule",
    {
      description: "Create schedules. Pass an `items` array of objects, each with required task_id and recurrence_type (once/daily/weekly/monthly/seasonal/custom). Optional recurrence_rule (cron or description) and next_due (ISO date string).",
      inputSchema: {
        items: z.array(z.object({
          task_id: z.string().max(26),
          recurrence_type: z.enum([...RECURRENCE_TYPES]),
          recurrence_rule: z.string().max(500).optional(),
          next_due: z.string().max(30).optional(),
        })),
      },
    },
    ({ items }) => handle(() => scheduleService.create(items))
  );

  server.registerTool(
    "update_schedule",
    {
      description: "Update schedules by ID. Pass an `items` array with required id. Only provided fields are changed.",
      inputSchema: {
        items: z.array(z.object({
          id: z.string().max(26),
          recurrence_type: z.enum([...RECURRENCE_TYPES]).optional(),
          recurrence_rule: z.string().max(500).optional().nullable(),
          next_due: z.string().max(30).optional().nullable(),
          last_completed: z.string().max(30).optional().nullable(),
        })),
      },
    },
    ({ items }) => handle(() => scheduleService.update(items))
  );

  server.registerTool(
    "delete_schedules",
    {
      description: "Permanently delete schedules by ID. This is destructive and cannot be undone. Pass an `ids` array of schedule ID strings.",
      inputSchema: {
        ids: z.array(z.string().max(26)),
      },
    },
    ({ ids }) => handle(() => { const deleted = scheduleService.remove(ids); return { deleted }; })
  );

  // -- Composite tools -----------------------------------------------------

  server.registerTool(
    "get_daily_summary",
    {
      description:
        "Compute the daily actionable summary. Returns overdue, due-today, and upcoming items with task details, schedule info, linked notes, days overdue, and human-readable recurrence labels.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO date (YYYY-MM-DD). Defaults to today."),
        lookahead_days: z.number().int().min(0).max(90).optional().describe("Number of days to look ahead for upcoming items. Defaults to 7."),
      },
    },
    ({ date, lookahead_days }) =>
      handle(() => {
        const now = new Date();
        const targetDate =
          date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const lookahead = lookahead_days ?? 7;
        return buildDailySummary(targetDate, lookahead, scheduleRepo, homeTaskRepo, noteRepo);
      })
  );

  server.registerTool(
    "complete_task",
    {
      description:
        "Mark a task occurrence as done and advance its schedule. For one-off tasks, sets status to done. For recurring tasks, advances the schedule to the next due date without changing task status. Optionally logs a completion note.",
      inputSchema: {
        task_id: z.string().max(26),
        note: z.string().max(10000).optional().describe("Optional completion note text."),
      },
    },
    ({ task_id, note }) =>
      handle(() => completeTask(ctx.db, ctx, { task_id, note }))
  );

  return server;
}

/**
 * Create a stateless HTTP handler that reuses a single McpServer instance.
 *
 * McpServer supports sequential connect -> handle -> close cycles (close() resets
 * the internal transport reference), but does NOT support concurrent connections.
 * A promise chain serializes requests so connect() is never called while a
 * previous transport is still active.
 */
export function createMcpHttpHandler(ctx: McpServiceContext): (req: Request) => Promise<Response> {
  const server = createMcpServer(ctx);
  let pending: Promise<unknown> = Promise.resolve();

  return (req: Request): Promise<Response> => {
    const result = pending.then(async () => {
      // enableJsonResponse is load-bearing: without it the transport returns SSE streams,
      // which breaks the serialized promise-chain handler above.
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
