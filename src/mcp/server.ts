import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  ServiceError,
  type INoteService,
  type NoteRepository,
} from "../domain";

export interface McpServiceContext {
  noteService: INoteService;
  noteRepo: NoteRepository;
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

/** Create an McpServer with note CRUD tools registered. */
export function createMcpServer(ctx: McpServiceContext): McpServer {
  const { noteService } = ctx;

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
