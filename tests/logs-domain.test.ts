import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { bootstrap, type AppContext } from "../src/domain/bootstrap";
import { ServiceError } from "../src/domain/errors";
import type { DomainEvent } from "../src/domain/events";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  await ctx.sql`DELETE FROM log_entry_reactions`;
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;
});

afterAll(async () => {
  await ctx.sql`DELETE FROM log_entry_reactions`;
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;
  await ctx.sql.end();
});

beforeEach(async () => {
  await ctx.sql`DELETE FROM log_entry_reactions`;
  await ctx.sql`DELETE FROM log_entries`;
  await ctx.sql`DELETE FROM logs`;
});

describe("LogService CRUD", () => {
  test("create log with all fields", async () => {
    const [log] = await ctx.logService.create([
      { name: "Plant watering", description: "Water the houseplants" },
    ]);
    expect(log.id).toBeDefined();
    expect(log.name).toBe("Plant watering");
    expect(log.description).toBe("Water the houseplants");
    expect(log.created_at).toBeDefined();
    expect(log.updated_at).toBeDefined();
  });

  test("create log without description", async () => {
    const [log] = await ctx.logService.create([{ name: "Trash out" }]);
    expect(log.description).toBeNull();
  });

  test("get log by id", async () => {
    const [log] = await ctx.logService.create([{ name: "Cat threw up" }]);
    const fetched = await ctx.logService.get(log.id);
    expect(fetched.id).toBe(log.id);
    expect(fetched.name).toBe("Cat threw up");
  });

  test("get non-existent log returns 404", async () => {
    expect(ctx.logService.get("nonexistent")).rejects.toThrow(ServiceError);
  });

  test("update name and description", async () => {
    const [log] = await ctx.logService.create([{ name: "Original" }]);
    const [updated] = await ctx.logService.update([
      { id: log.id, name: "Renamed", description: "New desc" },
    ]);
    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("New desc");
  });

  test("set description to null via update", async () => {
    const [log] = await ctx.logService.create([
      { name: "Thing", description: "Has desc" },
    ]);
    const [updated] = await ctx.logService.update([
      { id: log.id, description: null },
    ]);
    expect(updated.description).toBeNull();
  });

  test("delete log", async () => {
    const [log] = await ctx.logService.create([{ name: "Delete me" }]);
    const deleted = await ctx.logService.remove([log.id]);
    expect(deleted).toBe(1);
    expect(ctx.logService.get(log.id)).rejects.toThrow(ServiceError);
  });

  test("list with pagination", async () => {
    await ctx.logService.create([
      { name: "A" },
      { name: "B" },
      { name: "C" },
      { name: "D" },
    ]);
    const page1 = await ctx.logService.list({ limit: 2, offset: 0 });
    expect(page1.data.length).toBe(2);
    expect(page1.total).toBe(4);
    const page2 = await ctx.logService.list({ limit: 2, offset: 2 });
    expect(page2.data.length).toBe(2);
  });

  test("list filters by name", async () => {
    await ctx.logService.create([
      { name: "Plant watering" },
      { name: "Trash out" },
    ]);
    const result = await ctx.logService.list({ name: "plant" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].name).toBe("Plant watering");
  });
});

describe("LogService validation", () => {
  test("empty name rejected", async () => {
    expect(ctx.logService.create([{ name: "   " }])).rejects.toThrow(ServiceError);
  });

  test("name > 255 chars rejected", async () => {
    expect(
      ctx.logService.create([{ name: "x".repeat(256) }])
    ).rejects.toThrow(ServiceError);
  });

  test("description > 50000 chars rejected", async () => {
    expect(
      ctx.logService.create([{ name: "Valid", description: "x".repeat(50001) }])
    ).rejects.toThrow(ServiceError);
  });

  test("update empty name rejected", async () => {
    const [log] = await ctx.logService.create([{ name: "Before" }]);
    expect(
      ctx.logService.update([{ id: log.id, name: "   " }])
    ).rejects.toThrow(ServiceError);
  });

  test("update non-existent log rejected", async () => {
    expect(
      ctx.logService.update([{ id: "missing", name: "x" }])
    ).rejects.toThrow(ServiceError);
  });
});

describe("LogSummary projections", () => {
  test("entry_count and last_logged_at reflect entries", async () => {
    const [log] = await ctx.logService.create([{ name: "Runs" }]);
    await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-02-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-03-01T00:00:00.000Z" },
    ]);

    const result = await ctx.logService.list();
    const summary = result.data.find((l) => l.id === log.id)!;
    expect(summary.entry_count).toBe(3);
    expect(summary.last_logged_at).toBe("2026-03-01T00:00:00.000Z");
  });

  test("backdated entry with latest occurred_at becomes last_logged_at", async () => {
    const [log] = await ctx.logService.create([{ name: "Backdated" }]);
    // Oldest-created entry has the latest occurred_at
    await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2030-12-31T00:00:00.000Z" },
    ]);
    // then an older occurred_at created later
    await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2020-01-01T00:00:00.000Z" },
    ]);

    const result = await ctx.logService.list();
    const summary = result.data.find((l) => l.id === log.id)!;
    expect(summary.entry_count).toBe(2);
    expect(summary.last_logged_at).toBe("2030-12-31T00:00:00.000Z");
  });

  test("log with no entries has null last_logged_at and 0 entry_count", async () => {
    const [log] = await ctx.logService.create([{ name: "Empty" }]);
    const result = await ctx.logService.list();
    const summary = result.data.find((l) => l.id === log.id)!;
    expect(summary.entry_count).toBe(0);
    expect(summary.last_logged_at).toBeNull();
  });
});

describe("LogEntryService CRUD", () => {
  test("create entry with occurred_at defaulting to now", async () => {
    const [log] = await ctx.logService.create([{ name: "Now" }]);
    const before = new Date().toISOString();
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);
    const after = new Date().toISOString();
    expect(entry.log_id).toBe(log.id);
    expect(entry.occurred_at >= before).toBe(true);
    expect(entry.occurred_at <= after).toBe(true);
    expect(entry.note).toBeNull();
    expect(entry.metadata).toBeNull();
  });

  test("create entry with full payload", async () => {
    const [log] = await ctx.logService.create([{ name: "Called mom" }]);
    const [entry] = await ctx.logEntryService.create([
      {
        log_id: log.id,
        occurred_at: "2026-04-01T12:00:00.000Z",
        note: "Long chat",
        metadata: { duration_min: 42 },
      },
    ]);
    expect(entry.note).toBe("Long chat");
    expect(entry.metadata).toEqual({ duration_min: 42 });
    expect(entry.occurred_at).toBe("2026-04-01T12:00:00.000Z");
  });

  test("get entry by id", async () => {
    const [log] = await ctx.logService.create([{ name: "Log1" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);
    const fetched = await ctx.logEntryService.get(entry.id);
    expect(fetched.id).toBe(entry.id);
  });

  test("get non-existent entry returns 404", async () => {
    expect(ctx.logEntryService.get("nope")).rejects.toThrow(ServiceError);
  });

  test("update entry fields", async () => {
    const [log] = await ctx.logService.create([{ name: "Log1" }]);
    const [entry] = await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z", note: "first" },
    ]);
    const [updated] = await ctx.logEntryService.update([
      { id: entry.id, note: "second", metadata: { foo: "bar" } },
    ]);
    expect(updated.note).toBe("second");
    expect(updated.metadata).toEqual({ foo: "bar" });
    expect(updated.occurred_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("delete entries", async () => {
    const [log] = await ctx.logService.create([{ name: "Log1" }]);
    const entries = await ctx.logEntryService.create([
      { log_id: log.id },
      { log_id: log.id },
    ]);
    const deleted = await ctx.logEntryService.remove(entries.map((e) => e.id));
    expect(deleted).toBe(2);
  });

  test("list filters by log_id", async () => {
    const [a] = await ctx.logService.create([{ name: "A" }]);
    const [b] = await ctx.logService.create([{ name: "B" }]);
    await ctx.logEntryService.create([
      { log_id: a.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: a.id, occurred_at: "2026-02-01T00:00:00.000Z" },
      { log_id: b.id, occurred_at: "2026-03-01T00:00:00.000Z" },
    ]);
    const resultA = await ctx.logEntryService.list({ log_id: a.id });
    expect(resultA.total).toBe(2);
    const resultB = await ctx.logEntryService.list({ log_id: b.id });
    expect(resultB.total).toBe(1);
  });

  test("list orders by occurred_at DESC", async () => {
    const [log] = await ctx.logService.create([{ name: "Ordered" }]);
    await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-03-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-02-01T00:00:00.000Z" },
    ]);
    const result = await ctx.logEntryService.list({ log_id: log.id });
    expect(result.data[0].occurred_at).toBe("2026-03-01T00:00:00.000Z");
    expect(result.data[2].occurred_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("list filters by occurred_at range", async () => {
    const [log] = await ctx.logService.create([{ name: "Range" }]);
    await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-06-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-12-01T00:00:00.000Z" },
    ]);
    const result = await ctx.logEntryService.list({
      log_id: log.id,
      occurred_at_from: "2026-03-01T00:00:00.000Z",
      occurred_at_to: "2026-09-01T00:00:00.000Z",
    });
    expect(result.total).toBe(1);
    expect(result.data[0].occurred_at).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("LogEntryService validation", () => {
  test("missing log_id rejected", async () => {
    expect(
      ctx.logEntryService.create([{ log_id: "" } as any])
    ).rejects.toThrow(ServiceError);
  });

  test("non-existent log_id rejected", async () => {
    expect(
      ctx.logEntryService.create([{ log_id: "missing-log" }])
    ).rejects.toThrow(ServiceError);
  });

  test("invalid occurred_at rejected", async () => {
    const [log] = await ctx.logService.create([{ name: "L" }]);
    expect(
      ctx.logEntryService.create([{ log_id: log.id, occurred_at: "not-a-date" }])
    ).rejects.toThrow(ServiceError);
  });

  test("note > 50000 chars rejected", async () => {
    const [log] = await ctx.logService.create([{ name: "L" }]);
    expect(
      ctx.logEntryService.create([{ log_id: log.id, note: "x".repeat(50001) }])
    ).rejects.toThrow(ServiceError);
  });

  test("metadata as array rejected", async () => {
    const [log] = await ctx.logService.create([{ name: "L" }]);
    expect(
      ctx.logEntryService.create([{ log_id: log.id, metadata: [1, 2, 3] as any }])
    ).rejects.toThrow(ServiceError);
  });

  test("update with invalid occurred_at rejected", async () => {
    const [log] = await ctx.logService.create([{ name: "L" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);
    expect(
      ctx.logEntryService.update([{ id: entry.id, occurred_at: "nope" }])
    ).rejects.toThrow(ServiceError);
  });
});

describe("Cascade delete", () => {
  test("deleting a log removes its entries", async () => {
    const [log] = await ctx.logService.create([{ name: "Parent" }]);
    await ctx.logEntryService.create([
      { log_id: log.id },
      { log_id: log.id },
      { log_id: log.id },
    ]);

    const before = await ctx.logEntryService.list({ log_id: log.id });
    expect(before.total).toBe(3);

    await ctx.logService.remove([log.id]);

    const after = await ctx.logEntryService.list({ log_id: log.id });
    expect(after.total).toBe(0);
  });
});

describe("LogEntryService reactions", () => {
  test("applyReaction increments count on repeated calls (happy path)", async () => {
    const [log] = await ctx.logService.create([{ name: "React" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);

    const first = await ctx.logEntryService.applyReaction(entry.id, "❤️");
    expect(first.log_entry_id).toBe(entry.id);
    expect(first.emoji).toBe("❤️");
    expect(first.count).toBe(1);

    const second = await ctx.logEntryService.applyReaction(entry.id, "❤️");
    expect(second.count).toBe(2);

    const third = await ctx.logEntryService.applyReaction(entry.id, "❤️");
    expect(third.count).toBe(3);

    // Different emoji starts fresh at 1
    const fire = await ctx.logEntryService.applyReaction(entry.id, "🔥");
    expect(fire.count).toBe(1);

    const rows = await ctx.logEntryReactionRepo.list(entry.id);
    expect(rows.length).toBe(2);
  });

  test("applyReaction rejects emoji outside the palette", async () => {
    const [log] = await ctx.logService.create([{ name: "Palette" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);

    expect(ctx.logEntryService.applyReaction(entry.id, "😀")).rejects.toThrow(ServiceError);
    expect(ctx.logEntryService.applyReaction(entry.id, "")).rejects.toThrow(ServiceError);
    expect(ctx.logEntryService.applyReaction(entry.id, "❤")).rejects.toThrow(ServiceError);

    // No row was ever inserted
    const rows = await ctx.logEntryReactionRepo.list(entry.id);
    expect(rows.length).toBe(0);
  });

  test("applyReaction rejects non-existent log entry", async () => {
    expect(ctx.logEntryService.applyReaction("missing-entry", "👍")).rejects.toThrow(ServiceError);
  });

  test("cascade delete removes reactions when parent log entry is deleted", async () => {
    const [log] = await ctx.logService.create([{ name: "Cascade" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);

    await ctx.logEntryService.applyReaction(entry.id, "❤️");
    await ctx.logEntryService.applyReaction(entry.id, "🎉");
    await ctx.logEntryService.applyReaction(entry.id, "🎉");

    const before = await ctx.logEntryReactionRepo.list(entry.id);
    expect(before.length).toBe(2);

    // Delete the log entry directly → reactions should cascade
    await ctx.logEntryService.remove([entry.id]);

    const after = await ctx.logEntryReactionRepo.list(entry.id);
    expect(after.length).toBe(0);

    // And also cascade through the parent log
    const [entry2] = await ctx.logEntryService.create([{ log_id: log.id }]);
    await ctx.logEntryService.applyReaction(entry2.id, "🔥");
    await ctx.logService.remove([log.id]);
    const afterLog = await ctx.logEntryReactionRepo.list(entry2.id);
    expect(afterLog.length).toBe(0);
  });

  test("projection returns empty arrays for entries with no reactions", async () => {
    const [log] = await ctx.logService.create([{ name: "Empty" }]);
    const entries = await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-02-01T00:00:00.000Z" },
    ]);

    const projections = await ctx.logEntryReactionRepo.projectionsForIds(entries.map((e) => e.id));
    expect(projections.size).toBe(2);
    for (const entry of entries) {
      expect(projections.get(entry.id)).toEqual([]);
    }

    // And via the service.list path, summaries carry reactions: []
    const result = await ctx.logEntryService.list({ log_id: log.id });
    expect(result.data.length).toBe(2);
    for (const summary of result.data) {
      expect(summary.reactions).toEqual([]);
    }
  });

  test("projection batches reactions correctly for mixed entries", async () => {
    const [log] = await ctx.logService.create([{ name: "Batch" }]);
    const entries = await ctx.logEntryService.create([
      { log_id: log.id, occurred_at: "2026-01-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-02-01T00:00:00.000Z" },
      { log_id: log.id, occurred_at: "2026-03-01T00:00:00.000Z" },
    ]);
    const [a, b, c] = entries;

    // a gets two emojis with different counts
    await ctx.logEntryService.applyReaction(a.id, "❤️");
    await ctx.logEntryService.applyReaction(a.id, "❤️");
    await ctx.logEntryService.applyReaction(a.id, "🔥");

    // b gets one emoji, single count
    await ctx.logEntryService.applyReaction(b.id, "🎉");

    // c gets nothing

    const projections = await ctx.logEntryReactionRepo.projectionsForIds([a.id, b.id, c.id]);
    expect(projections.size).toBe(3);

    const aReactions = projections.get(a.id)!;
    expect(aReactions.length).toBe(2);
    const aMap = new Map(aReactions.map((r) => [r.emoji, r.count]));
    expect(aMap.get("❤️")).toBe(2);
    expect(aMap.get("🔥")).toBe(1);

    expect(projections.get(b.id)).toEqual([{ emoji: "🎉", count: 1 }]);
    expect(projections.get(c.id)).toEqual([]);

    // Service.list surfaces the same projection on summaries
    const result = await ctx.logEntryService.list({ log_id: log.id });
    const byId = new Map(result.data.map((e) => [e.id, e]));
    expect(byId.get(a.id)!.reactions.length).toBe(2);
    expect(byId.get(b.id)!.reactions).toEqual([{ emoji: "🎉", count: 1 }]);
    expect(byId.get(c.id)!.reactions).toEqual([]);
  });

  test("projectionsForIds handles empty id list", async () => {
    const projections = await ctx.logEntryReactionRepo.projectionsForIds([]);
    expect(projections.size).toBe(0);
  });
});

describe("EventBus emissions", () => {
  test("log and log_entry events fire with correct entity_type", async () => {
    const events: DomainEvent[] = [];
    const unsubscribe = ctx.eventBus.subscribe((e) => events.push(e));

    const [log] = await ctx.logService.create([{ name: "Events" }]);
    await ctx.logService.update([{ id: log.id, name: "Renamed" }]);
    const [entry] = await ctx.logEntryService.create([{ log_id: log.id }]);
    await ctx.logEntryService.update([{ id: entry.id, note: "x" }]);
    await ctx.logEntryService.remove([entry.id]);
    await ctx.logService.remove([log.id]);

    unsubscribe();

    const logEvents = events.filter((e) => e.entity_type === "log");
    const entryEvents = events.filter((e) => e.entity_type === "log_entry");
    expect(logEvents.map((e) => e.type)).toEqual(["created", "updated", "deleted"]);
    expect(entryEvents.map((e) => e.type)).toEqual(["created", "updated", "deleted"]);
  });
});
