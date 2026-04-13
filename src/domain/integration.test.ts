import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { bootstrap, type AppContext } from "./bootstrap";
import { ServiceError } from "./errors";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  // Clean slate
  await ctx.sql`DELETE FROM notes`;
});

afterAll(async () => {
  await ctx.sql`DELETE FROM notes`;
  await ctx.sql.end();
});

describe("NoteService", () => {
  let noteId: string;

  test("create a note", async () => {
    const [note] = await ctx.noteService.create([
      { title: "Test note", context: "Some context here" },
    ]);
    expect(note.id).toBeDefined();
    expect(note.title).toBe("Test note");
    expect(note.context).toBe("Some context here");
    expect(note.created_at).toBeDefined();
    expect(note.updated_at).toBeDefined();
    noteId = note.id;
  });

  test("create a note without context", async () => {
    const [note] = await ctx.noteService.create([{ title: "No context" }]);
    expect(note.context).toBeNull();
    // cleanup
    await ctx.noteService.remove([note.id]);
  });

  test("create rejects empty title", async () => {
    expect(ctx.noteService.create([{ title: "  " }])).rejects.toThrow(ServiceError);
  });

  test("create rejects title over 255 chars", async () => {
    expect(ctx.noteService.create([{ title: "x".repeat(256) }])).rejects.toThrow(ServiceError);
  });

  test("create rejects context over 50000 chars", async () => {
    expect(
      ctx.noteService.create([{ title: "big", context: "x".repeat(50001) }])
    ).rejects.toThrow(ServiceError);
  });

  test("get a note by id", async () => {
    const note = await ctx.noteService.get(noteId);
    expect(note.id).toBe(noteId);
    expect(note.title).toBe("Test note");
    expect(note.context).toBe("Some context here");
  });

  test("get throws 404 for missing id", async () => {
    expect(ctx.noteService.get("nonexistent")).rejects.toThrow(ServiceError);
  });

  test("update a note title", async () => {
    const [updated] = await ctx.noteService.update([
      { id: noteId, title: "Updated title" },
    ]);
    expect(updated.title).toBe("Updated title");
    expect(updated.context).toBe("Some context here"); // unchanged
  });

  test("update a note context", async () => {
    const [updated] = await ctx.noteService.update([
      { id: noteId, context: "New context" },
    ]);
    expect(updated.context).toBe("New context");
  });

  test("update can null out context", async () => {
    const [updated] = await ctx.noteService.update([
      { id: noteId, context: null },
    ]);
    expect(updated.context).toBeNull();
  });

  test("update rejects empty title", async () => {
    expect(
      ctx.noteService.update([{ id: noteId, title: "" }])
    ).rejects.toThrow(ServiceError);
  });

  test("update rejects missing id", async () => {
    expect(
      ctx.noteService.update([{ id: "nonexistent", title: "x" }])
    ).rejects.toThrow(ServiceError);
  });

  test("list notes with pagination", async () => {
    // Create several notes
    await ctx.noteService.create([
      { title: "Page note A" },
      { title: "Page note B" },
      { title: "Page note C" },
    ]);

    const page1 = await ctx.noteService.list({ limit: 2, offset: 0 });
    expect(page1.data.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(4); // 1 original + 3 new

    const page2 = await ctx.noteService.list({ limit: 2, offset: 2 });
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
  });

  test("list notes filtered by title", async () => {
    const result = await ctx.noteService.list({ title: "Page note" });
    expect(result.data.length).toBe(3);
    for (const n of result.data) {
      expect(n.title).toContain("Page note");
    }
  });

  test("list returns NoteSummary shape", async () => {
    const result = await ctx.noteService.list({ limit: 1 });
    const summary = result.data[0];
    expect(summary).toHaveProperty("id");
    expect(summary).toHaveProperty("title");
    expect(summary).toHaveProperty("has_context");
    expect(summary).toHaveProperty("created_at");
    expect(summary).toHaveProperty("updated_at");
    // Should not have full context field
    expect(summary).not.toHaveProperty("context");
  });

  test("delete notes", async () => {
    const all = await ctx.noteService.list({ limit: 100 });
    const ids = all.data.map((n) => n.id);
    const deleted = await ctx.noteService.remove(ids);
    expect(deleted).toBe(ids.length);

    const afterDelete = await ctx.noteService.list();
    expect(afterDelete.total).toBe(0);
  });

  test("delete empty array returns 0", async () => {
    const deleted = await ctx.noteService.remove([]);
    expect(deleted).toBe(0);
  });
});
