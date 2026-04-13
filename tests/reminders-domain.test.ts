import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { bootstrap, type AppContext } from "../src/domain/bootstrap";
import { ServiceError } from "../src/domain/errors";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://tab:tab@localhost:3101/at_home";

let ctx: AppContext;

beforeAll(async () => {
  ctx = await bootstrap(TEST_DB);
  // Clean slate
  await ctx.sql`DELETE FROM reminders`;
});

afterAll(async () => {
  await ctx.sql`DELETE FROM reminders`;
  await ctx.sql.end();
});

describe("ReminderService", () => {
  let reminderId: string;

  // -- CRUD ---------------------------------------------------------------

  test("create reminder with all fields", async () => {
    const [reminder] = await ctx.reminderService.create([
      {
        context: "Take out the trash",
        remind_at: "2026-05-01T09:00:00.000Z",
        recurrence: "weekly",
      },
    ]);
    expect(reminder.id).toBeDefined();
    expect(reminder.context).toBe("Take out the trash");
    expect(reminder.remind_at).toBe("2026-05-01T09:00:00.000Z");
    expect(reminder.recurrence).toBe("weekly");
    expect(reminder.dismissed_at).toBeNull();
    expect(reminder.created_at).toBeDefined();
    expect(reminder.updated_at).toBeDefined();
    reminderId = reminder.id;
  });

  test("create reminder without recurrence", async () => {
    const [reminder] = await ctx.reminderService.create([
      {
        context: "One-time meeting",
        remind_at: "2026-06-15T14:00:00.000Z",
      },
    ]);
    expect(reminder.recurrence).toBeNull();
    // cleanup
    await ctx.reminderService.remove([reminder.id]);
  });

  test("get reminder by id", async () => {
    const reminder = await ctx.reminderService.get(reminderId);
    expect(reminder.id).toBe(reminderId);
    expect(reminder.context).toBe("Take out the trash");
  });

  test("get non-existent reminder returns 404", async () => {
    expect(ctx.reminderService.get("nonexistent")).rejects.toThrow(ServiceError);
  });

  test("update context, remind_at, recurrence", async () => {
    const [updated] = await ctx.reminderService.update([
      {
        id: reminderId,
        context: "Updated context",
        remind_at: "2026-07-01T10:00:00.000Z",
        recurrence: "weekly",
      },
    ]);
    expect(updated.context).toBe("Updated context");
    expect(updated.remind_at).toBe("2026-07-01T10:00:00.000Z");
    expect(updated.recurrence).toBe("weekly");
  });

  test("set recurrence to null via update", async () => {
    const [updated] = await ctx.reminderService.update([
      { id: reminderId, recurrence: null },
    ]);
    expect(updated.recurrence).toBeNull();
  });

  test("delete reminder", async () => {
    const [toDelete] = await ctx.reminderService.create([
      { context: "Delete me", remind_at: "2026-08-01T00:00:00.000Z" },
    ]);
    const deleted = await ctx.reminderService.remove([toDelete.id]);
    expect(deleted).toBe(1);

    expect(ctx.reminderService.get(toDelete.id)).rejects.toThrow(ServiceError);
  });

  test("list with pagination", async () => {
    // Create several reminders
    await ctx.reminderService.create([
      { context: "Page A", remind_at: "2026-09-01T00:00:00.000Z" },
      { context: "Page B", remind_at: "2026-09-02T00:00:00.000Z" },
      { context: "Page C", remind_at: "2026-09-03T00:00:00.000Z" },
    ]);

    const page1 = await ctx.reminderService.list({ limit: 2, offset: 0 });
    expect(page1.data.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(4); // 1 original + 3 new

    const page2 = await ctx.reminderService.list({ limit: 2, offset: 2 });
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
  });

  // -- Validation ---------------------------------------------------------

  test("empty context rejected", async () => {
    expect(
      ctx.reminderService.create([{ context: "  ", remind_at: "2026-05-01T00:00:00.000Z" }])
    ).rejects.toThrow(ServiceError);
  });

  test("missing remind_at rejected", async () => {
    expect(
      ctx.reminderService.create([{ context: "Valid", remind_at: "" }])
    ).rejects.toThrow(ServiceError);
  });

  test("invalid recurrence value rejected", async () => {
    expect(
      ctx.reminderService.create([
        { context: "Valid", remind_at: "2026-05-01T00:00:00.000Z", recurrence: "biweekly" as any },
      ])
    ).rejects.toThrow(ServiceError);
  });

  test("invalid remind_at format rejected", async () => {
    expect(
      ctx.reminderService.create([{ context: "Valid", remind_at: "not-a-date" }])
    ).rejects.toThrow(ServiceError);
  });

  // -- Filtering ----------------------------------------------------------

  test("list with date range (remind_at_from / remind_at_to)", async () => {
    const result = await ctx.reminderService.list({
      remind_at_from: "2026-09-01T00:00:00.000Z",
      remind_at_to: "2026-09-02T00:00:00.000Z",
    });
    expect(result.data.length).toBe(2);
    for (const r of result.data) {
      expect(r.remind_at >= "2026-09-01T00:00:00.000Z").toBe(true);
      expect(r.remind_at <= "2026-09-02T00:00:00.000Z").toBe(true);
    }
  });

  test("list active only", async () => {
    const result = await ctx.reminderService.list({ status: "active" });
    for (const r of result.data) {
      expect(r.is_active).toBe(true);
    }
    expect(result.total).toBeGreaterThan(0);
  });

  test("list dormant only (none yet)", async () => {
    const result = await ctx.reminderService.list({ status: "dormant" });
    // All reminders so far are active, so dormant should be empty
    expect(result.data.length).toBe(0);
    expect(result.total).toBe(0);
  });

  test("combined date range + status filter", async () => {
    const result = await ctx.reminderService.list({
      remind_at_from: "2026-09-01T00:00:00.000Z",
      remind_at_to: "2026-09-03T00:00:00.000Z",
      status: "active",
    });
    expect(result.data.length).toBe(3);
    for (const r of result.data) {
      expect(r.is_active).toBe(true);
    }
  });

  // -- Dismiss logic ------------------------------------------------------

  test("dismiss non-recurring → becomes dormant", async () => {
    const [nonRecurring] = await ctx.reminderService.create([
      { context: "One-time task", remind_at: "2026-04-10T09:00:00.000Z" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: nonRecurring.id });
    expect(dismissed.dismissed_at).toBeDefined();
    expect(dismissed.dismissed_at).not.toBeNull();
    // remind_at unchanged — dismissed_at >= remind_at makes it dormant
    expect(dismissed.remind_at).toBe("2026-04-10T09:00:00.000Z");

    // Verify dormant via list filter
    const dormant = await ctx.reminderService.list({ status: "dormant", context: "One-time task" });
    expect(dormant.data.length).toBe(1);
    expect(dormant.data[0].id).toBe(nonRecurring.id);
    expect(dormant.data[0].is_active).toBe(false);
  });

  test("dismiss recurring (weekly) → remind_at advances by 7 days (first)", async () => {
    const [weekly] = await ctx.reminderService.create([
      { context: "Weekly standup", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "weekly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: weekly.id });
    expect(dismissed.dismissed_at).not.toBeNull();
    expect(dismissed.remind_at).toBe("2026-05-08T09:00:00.000Z");

    // cleanup
    await ctx.reminderService.remove([weekly.id]);
  });

  test("dismiss recurring (weekly) → remind_at advances by 7 days", async () => {
    const [weekly] = await ctx.reminderService.create([
      { context: "Weekly review", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "weekly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: weekly.id });
    expect(dismissed.remind_at).toBe("2026-05-08T09:00:00.000Z");

    await ctx.reminderService.remove([weekly.id]);
  });

  test("dismiss recurring (monthly) → remind_at advances by 1 month", async () => {
    const [monthly] = await ctx.reminderService.create([
      { context: "Monthly report", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "monthly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: monthly.id });
    expect(dismissed.remind_at).toBe("2026-06-01T09:00:00.000Z");

    await ctx.reminderService.remove([monthly.id]);
  });

  test("dismiss recurring (yearly) → remind_at advances by 1 year", async () => {
    const [yearly] = await ctx.reminderService.create([
      { context: "Annual review", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "yearly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: yearly.id });
    expect(dismissed.remind_at).toBe("2027-05-01T09:00:00.000Z");

    await ctx.reminderService.remove([yearly.id]);
  });

  test("dismiss with override remind_at → uses override regardless of recurrence", async () => {
    const [recurring] = await ctx.reminderService.create([
      { context: "Override test", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "weekly" },
    ]);

    const overrideDate = "2026-12-25T12:00:00.000Z";
    const dismissed = await ctx.reminderService.dismiss({
      id: recurring.id,
      remind_at: overrideDate,
    });
    expect(dismissed.remind_at).toBe(overrideDate);

    await ctx.reminderService.remove([recurring.id]);
  });

  test("monthly edge case: Jan 31 + 1 month", async () => {
    const [jan31] = await ctx.reminderService.create([
      { context: "End of month", remind_at: "2026-01-31T09:00:00.000Z", recurrence: "monthly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: jan31.id });
    // JavaScript Date setUTCMonth(1) on Jan 31 overflows to Mar 3 (28 days in Feb 2026)
    const advanced = new Date("2026-01-31T09:00:00.000Z");
    advanced.setUTCMonth(advanced.getUTCMonth() + 1);
    expect(dismissed.remind_at).toBe(advanced.toISOString());

    await ctx.reminderService.remove([jan31.id]);
  });

  test("dismissed recurring reminder is still active (has future remind_at)", async () => {
    const [recurring] = await ctx.reminderService.create([
      { context: "Still active after dismiss", remind_at: "2026-05-01T09:00:00.000Z", recurrence: "weekly" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: recurring.id });
    // dismissed_at is "now" which is before the new remind_at (2026-05-02), so still active
    expect(dismissed.dismissed_at).not.toBeNull();
    expect(dismissed.remind_at).toBe("2026-05-08T09:00:00.000Z");
    // dismissed_at < remind_at → active
    expect(dismissed.dismissed_at! < dismissed.remind_at).toBe(true);

    const activeList = await ctx.reminderService.list({ status: "active", context: "Still active after dismiss" });
    expect(activeList.data.length).toBe(1);

    await ctx.reminderService.remove([recurring.id]);
  });

  test("dismissed non-recurring reminder is dormant", async () => {
    const [nonRecurring] = await ctx.reminderService.create([
      { context: "Dormant check", remind_at: "2026-04-10T09:00:00.000Z" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: nonRecurring.id });
    // dismissed_at is "now" (2026-04-12+) which is >= remind_at (2026-04-10) → dormant
    expect(dismissed.dismissed_at! >= dismissed.remind_at).toBe(true);

    const dormantList = await ctx.reminderService.list({ status: "dormant", context: "Dormant check" });
    expect(dormantList.data.length).toBe(1);
    expect(dormantList.data[0].is_active).toBe(false);

    await ctx.reminderService.remove([nonRecurring.id]);
  });

  test("dismiss non-recurring with future remind_at → snaps remind_at to now, goes dormant", async () => {
    const [futureReminder] = await ctx.reminderService.create([
      { context: "Future dismiss check", remind_at: "2099-12-31T23:59:00.000Z" },
    ]);

    const dismissed = await ctx.reminderService.dismiss({ id: futureReminder.id });
    // remind_at should be snapped to now so dismissed_at >= remind_at → dormant
    expect(dismissed.dismissed_at).not.toBeNull();
    expect(dismissed.remind_at).not.toBe("2099-12-31T23:59:00.000Z");
    expect(dismissed.dismissed_at! >= dismissed.remind_at).toBe(true);

    const dormantList = await ctx.reminderService.list({ status: "dormant", context: "Future dismiss check" });
    expect(dormantList.data.length).toBe(1);
    expect(dormantList.data[0].is_active).toBe(false);

    await ctx.reminderService.remove([futureReminder.id]);
  });

  // -- Reactivation -------------------------------------------------------

  test("update dormant reminder with new remind_at → becomes active", async () => {
    // Create and dismiss a non-recurring reminder to make it dormant
    const [reminder] = await ctx.reminderService.create([
      { context: "Reactivate me", remind_at: "2026-04-01T09:00:00.000Z" },
    ]);
    await ctx.reminderService.dismiss({ id: reminder.id });

    // Verify dormant
    const dormant = await ctx.reminderService.list({ status: "dormant", context: "Reactivate me" });
    expect(dormant.data.length).toBe(1);

    // Update with future remind_at → should become active (dismissed_at < new remind_at)
    const [reactivated] = await ctx.reminderService.update([
      { id: reminder.id, remind_at: "2099-01-01T00:00:00.000Z" },
    ]);
    expect(reactivated.remind_at).toBe("2099-01-01T00:00:00.000Z");

    const active = await ctx.reminderService.list({ status: "active", context: "Reactivate me" });
    expect(active.data.length).toBe(1);
    expect(active.data[0].id).toBe(reminder.id);

    await ctx.reminderService.remove([reminder.id]);
  });

  // -- Cleanup all remaining reminders ------------------------------------

  test("delete empty array returns 0", async () => {
    const deleted = await ctx.reminderService.remove([]);
    expect(deleted).toBe(0);
  });

  test("cleanup all reminders", async () => {
    const all = await ctx.reminderService.list({ limit: 100 });
    const ids = all.data.map((r) => r.id);
    if (ids.length > 0) {
      await ctx.reminderService.remove(ids);
    }
    const afterDelete = await ctx.reminderService.list();
    expect(afterDelete.total).toBe(0);
  });
});
