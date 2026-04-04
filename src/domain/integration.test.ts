import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrap, type AppContext } from "./bootstrap";
import { ServiceError } from "./errors";
import { buildDailySummary } from "./summary";
import { completeTask } from "./operations/complete-task";

let ctx: AppContext;
let tempDir: string;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "tab-at-home-test-"));
  ctx = await bootstrap(join(tempDir, "test.db"));
});

afterAll(() => {
  ctx.db.close();
  rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// HomeTask CRUD
// ---------------------------------------------------------------------------

describe("HomeTask CRUD", () => {
  it("creates a task with title only (defaults to active status)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Mow the lawn" }]);

    expect(task.id).toBeTruthy();
    expect(task.id.length).toBeGreaterThan(10); // ULID
    expect(task.title).toBe("Mow the lawn");
    expect(task.status).toBe("active");
    expect(task.description).toBeNull();
    expect(task.area).toBeNull();
    expect(task.effort).toBeNull();
    expect(task.created_at).toBeTruthy();
    expect(task.updated_at).toBeTruthy();
    expect(() => new Date(task.created_at)).not.toThrow();
  });

  it("creates a task with all fields", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Clean gutters",
      description: "Remove leaves and debris",
      area: "exterior",
      effort: "high",
    }]);

    expect(task.title).toBe("Clean gutters");
    expect(task.description).toBe("Remove leaves and debris");
    expect(task.area).toBe("exterior");
    expect(task.effort).toBe("high");
    expect(task.status).toBe("active"); // default
  });

  it("updates task title and status", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Original title" }]);
    const [updated] = ctx.homeTaskService.update([{
      id: task.id,
      title: "Updated title",
      status: "paused",
    }]);

    expect(updated.title).toBe("Updated title");
    expect(updated.status).toBe("paused");
  });

  it("lists tasks filtered by status", () => {
    const [t1] = ctx.homeTaskService.create([{ title: "StatusFilter Active", status: "active" }]);
    const [t2] = ctx.homeTaskService.create([{ title: "StatusFilter Done", status: "done" }]);

    const activeResult = ctx.homeTaskService.list({ status: "active" });
    expect(activeResult.data.some((t) => t.id === t1.id)).toBe(true);
    expect(activeResult.data.some((t) => t.id === t2.id)).toBe(false);

    const doneResult = ctx.homeTaskService.list({ status: "done" });
    expect(doneResult.data.some((t) => t.id === t2.id)).toBe(true);
  });

  it("lists tasks filtered by area", () => {
    const [t1] = ctx.homeTaskService.create([{ title: "AreaFilter Kitchen", area: "kitchen" }]);
    const [t2] = ctx.homeTaskService.create([{ title: "AreaFilter Yard", area: "yard" }]);

    const kitchenResult = ctx.homeTaskService.list({ area: "kitchen" });
    expect(kitchenResult.data.some((t) => t.id === t1.id)).toBe(true);
    expect(kitchenResult.data.some((t) => t.id === t2.id)).toBe(false);
  });

  it("deletes a task", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Delete me" }]);
    ctx.homeTaskService.remove([task.id]);

    expect(() => ctx.homeTaskService.get(task.id)).toThrow(ServiceError);
  });

  it("rejects empty title", () => {
    expect(() => ctx.homeTaskService.create([{ title: "" }])).toThrow(ServiceError);
  });

  it("rejects whitespace-only title", () => {
    expect(() => ctx.homeTaskService.create([{ title: "   " }])).toThrow(ServiceError);
  });

  it("rejects invalid status enum", () => {
    expect(() =>
      ctx.homeTaskService.create([{ title: "Bad status", status: "invalid" as any }])
    ).toThrow(ServiceError);
  });

  it("rejects invalid area enum", () => {
    expect(() =>
      ctx.homeTaskService.create([{ title: "Bad area", area: "rooftop" as any }])
    ).toThrow(ServiceError);
  });

  it("rejects invalid effort enum", () => {
    expect(() =>
      ctx.homeTaskService.create([{ title: "Bad effort", effort: "mega" as any }])
    ).toThrow(ServiceError);
  });

  it("throws 404 for nonexistent task", () => {
    expect(() => ctx.homeTaskService.get("nonexistent")).toThrow(ServiceError);
  });

  it("gets a task by id", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Fetch me" }]);
    const fetched = ctx.homeTaskService.get(task.id);
    expect(fetched.id).toBe(task.id);
    expect(fetched.title).toBe("Fetch me");
  });
});

// ---------------------------------------------------------------------------
// Note CRUD
// ---------------------------------------------------------------------------

describe("Note CRUD", () => {
  it("creates a standalone note (no task_id)", () => {
    const [note] = ctx.noteService.create([{ title: "Standalone note" }]);

    expect(note.id).toBeTruthy();
    expect(note.title).toBe("Standalone note");
    expect(note.task_id).toBeNull();
    expect(note.content).toBeNull();
    expect(note.created_at).toBeTruthy();
  });

  it("creates a note linked to a task", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Linked task" }]);
    const [note] = ctx.noteService.create([{
      title: "Linked note",
      content: "Some details",
      task_id: task.id,
    }]);

    expect(note.task_id).toBe(task.id);
    expect(note.content).toBe("Some details");
  });

  it("updates note, changes task_id", () => {
    const [task1] = ctx.homeTaskService.create([{ title: "Task A" }]);
    const [task2] = ctx.homeTaskService.create([{ title: "Task B" }]);
    const [note] = ctx.noteService.create([{ title: "Move me", task_id: task1.id }]);

    const [updated] = ctx.noteService.update([{ id: note.id, task_id: task2.id }]);
    expect(updated.task_id).toBe(task2.id);
  });

  it("unlinks note (sets task_id to null)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Unlink task" }]);
    const [note] = ctx.noteService.create([{ title: "Unlink note", task_id: task.id }]);

    expect(note.task_id).toBe(task.id);

    const [updated] = ctx.noteService.update([{ id: note.id, task_id: null }]);
    expect(updated.task_id).toBeNull();
  });

  it("rejects note with nonexistent task_id", () => {
    expect(() =>
      ctx.noteService.create([{ title: "Bad link", task_id: "nonexistent" }])
    ).toThrow(ServiceError);
  });

  it("deleting task sets linked notes task_id to null (ON DELETE SET NULL)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Delete cascade task" }]);
    const [note] = ctx.noteService.create([{ title: "Orphan note", task_id: task.id }]);

    expect(note.task_id).toBe(task.id);

    ctx.homeTaskService.remove([task.id]);

    const fetched = ctx.noteService.get(note.id);
    expect(fetched.task_id).toBeNull();
  });

  it("lists notes", () => {
    const result = ctx.noteService.list({ limit: 100 });
    expect(result.data).toBeArray();
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("deletes a note", () => {
    const [note] = ctx.noteService.create([{ title: "Delete note" }]);
    ctx.noteService.remove([note.id]);
    expect(() => ctx.noteService.get(note.id)).toThrow(ServiceError);
  });
});

// ---------------------------------------------------------------------------
// Schedule CRUD
// ---------------------------------------------------------------------------

describe("Schedule CRUD", () => {
  it("creates a schedule with daily recurrence and explicit next_due", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Daily task" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-10",
    }]);

    expect(schedule.id).toBeTruthy();
    expect(schedule.task_id).toBe(task.id);
    expect(schedule.recurrence_type).toBe("daily");
    expect(schedule.next_due).toBe("2026-04-10");
    expect(schedule.last_completed).toBeNull();
  });

  it("creates a schedule with monthly recurrence and auto-computed next_due", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Monthly task" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "monthly",
      recurrence_rule: JSON.stringify({ type: "monthly", day: 15 }),
      // no explicit next_due — should be auto-computed
    }]);

    expect(schedule.next_due).toBeTruthy();
    // The auto-computed date should be a valid YYYY-MM-DD
    expect(schedule.next_due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("prevents duplicate schedule for same task", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Dup schedule task" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-05-01",
    }]);

    expect(() =>
      ctx.scheduleService.create([{
        task_id: task.id,
        recurrence_type: "weekly",
        recurrence_rule: JSON.stringify({ type: "weekly", days: [1] }),
        next_due: "2026-05-01",
      }])
    ).toThrow(ServiceError);
  });

  it("rejects schedule with nonexistent task_id", () => {
    expect(() =>
      ctx.scheduleService.create([{
        task_id: "nonexistent",
        recurrence_type: "daily",
        recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
        next_due: "2026-05-01",
      }])
    ).toThrow(ServiceError);
  });

  it("rejects schedule with invalid recurrence_rule JSON", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Invalid rule task" }]);
    expect(() =>
      ctx.scheduleService.create([{
        task_id: task.id,
        recurrence_type: "daily",
        recurrence_rule: "not valid json {{{",
        next_due: "2026-05-01",
      }])
    ).toThrow(ServiceError);
  });

  it("lists schedules", () => {
    const result = ctx.scheduleService.list({ limit: 100 });
    expect(result.data).toBeArray();
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("gets a schedule by id", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Get schedule task" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-06-01",
    }]);
    const fetched = ctx.scheduleService.get(schedule.id);
    expect(fetched.id).toBe(schedule.id);
  });
});

// ---------------------------------------------------------------------------
// Schedule Advance
// ---------------------------------------------------------------------------

describe("Schedule Advance", () => {
  it("daily schedule: advance sets next_due forward from previous next_due", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Advance daily" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);

    expect(advanced.last_completed).toBeTruthy();
    // For daily interval 1, next_due should be previous next_due + 1 day
    expect(advanced.next_due).toBe("2026-04-02");
  });

  it("once schedule: advance sets next_due to null", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Advance once" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);

    expect(advanced.next_due).toBeNull();
    expect(advanced.last_completed).toBeTruthy();
  });

  it("weekly schedule: advance computes next weekday from previous next_due", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Advance weekly" }]);
    // Schedule for Mondays (1) and Fridays (5), next_due is Monday 2026-04-06
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "weekly",
      recurrence_rule: JSON.stringify({ type: "weekly", days: [1, 5] }),
      next_due: "2026-04-06", // Monday
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);

    expect(advanced.last_completed).toBeTruthy();
    // From Monday (day 1), the next matching day > 1 is Friday (day 5)
    // Monday 2026-04-06 + 4 days = Friday 2026-04-10
    expect(advanced.next_due).toBe("2026-04-10");
  });
});

// ---------------------------------------------------------------------------
// Daily Summary
// ---------------------------------------------------------------------------

describe("Daily Summary", () => {
  it("categorizes overdue, due_today, and upcoming correctly", () => {
    // Create three tasks with schedules at known dates
    const [overdueTask] = ctx.homeTaskService.create([{ title: "Summary Overdue Task" }]);
    const [todayTask] = ctx.homeTaskService.create([{ title: "Summary Today Task" }]);
    const [upcomingTask] = ctx.homeTaskService.create([{ title: "Summary Upcoming Task" }]);

    ctx.scheduleService.create([{
      task_id: overdueTask.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01", // before the reference date
    }]);

    ctx.scheduleService.create([{
      task_id: todayTask.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05", // the reference date
    }]);

    ctx.scheduleService.create([{
      task_id: upcomingTask.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-08", // after the reference date, within lookahead
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    expect(summary.date).toBe("2026-04-05");

    // Overdue: task with next_due 2026-04-01
    expect(summary.overdue.some((i) => i.task.id === overdueTask.id)).toBe(true);
    const overdueItem = summary.overdue.find((i) => i.task.id === overdueTask.id)!;
    expect(overdueItem.days_overdue).toBe(4);

    // Due today: task with next_due 2026-04-05
    expect(summary.due_today.some((i) => i.task.id === todayTask.id)).toBe(true);

    // Upcoming: task with next_due 2026-04-08
    expect(summary.upcoming.some((i) => i.task.id === upcomingTask.id)).toBe(true);

    // Counts
    expect(summary.counts.overdue).toBeGreaterThanOrEqual(1);
    expect(summary.counts.due_today).toBeGreaterThanOrEqual(1);
    expect(summary.counts.upcoming).toBeGreaterThanOrEqual(1);
  });

  it("excludes archived tasks from daily summary", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Summary Archived Task",
      status: "archived",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    // The archived task should not appear in any category
    const allItems = [...summary.overdue, ...summary.due_today, ...summary.upcoming];
    expect(allItems.some((i) => i.task.id === task.id)).toBe(false);
  });

  it("excludes done tasks from daily summary", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Summary Done Task",
      status: "done",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    const allItems = [...summary.overdue, ...summary.due_today, ...summary.upcoming];
    expect(allItems.some((i) => i.task.id === task.id)).toBe(false);
  });

  it("includes linked notes in summary items", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Summary Note Task" }]);
    const [note] = ctx.noteService.create([{
      title: "Summary note",
      content: "Important detail",
      task_id: task.id,
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    const item = summary.due_today.find((i) => i.task.id === task.id);
    expect(item).toBeTruthy();
    expect(item!.notes.length).toBeGreaterThanOrEqual(1);
    expect(item!.notes.some((n) => n.id === note.id)).toBe(true);
  });

  it("returns a valid empty summary when no schedules match the date window", () => {
    // Use a far-past date so nothing is due or upcoming
    const summary = buildDailySummary(
      "1990-01-01",
      1,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    expect(summary.date).toBe("1990-01-01");
    expect(summary.overdue).toBeArray();
    expect(summary.due_today).toBeArray();
    expect(summary.upcoming).toBeArray();
    expect(summary.counts.overdue).toBe(0);
    expect(summary.counts.due_today).toBe(0);
    expect(summary.counts.upcoming).toBe(0);
    expect(summary.counts.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

describe("Activity Log", () => {
  it("logs activity on task create", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Activity create task" }]);

    const logs = ctx.activityLogRepo.findMany({
      entity_type: "home_task",
      entity_id: task.id,
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const createLog = logs.find((l) => l.action === "created");
    expect(createLog).toBeTruthy();
    expect(createLog!.entity_id).toBe(task.id);
  });

  it("logs activity on task update", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Activity update task" }]);
    ctx.homeTaskService.update([{ id: task.id, title: "Updated" }]);

    const logs = ctx.activityLogRepo.findMany({
      entity_type: "home_task",
      entity_id: task.id,
    });

    const updateLog = logs.find((l) => l.action === "updated");
    expect(updateLog).toBeTruthy();
  });

  it("logs activity on task delete", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Activity delete task" }]);
    const taskId = task.id;
    ctx.homeTaskService.remove([taskId]);

    const logs = ctx.activityLogRepo.findMany({
      entity_type: "home_task",
      entity_id: taskId,
    });

    const deleteLog = logs.find((l) => l.action === "deleted");
    expect(deleteLog).toBeTruthy();
  });

  it("logs 'completed' action on schedule advance", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Activity advance task" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    ctx.scheduleService.advance(schedule.id);

    const logs = ctx.activityLogRepo.findMany({
      entity_type: "schedule",
      entity_id: schedule.id,
    });

    const completedLog = logs.find((l) => l.action === "completed");
    expect(completedLog).toBeTruthy();
    expect(completedLog!.entity_id).toBe(schedule.id);
  });

  it("logs activity on note create and delete", () => {
    const [note] = ctx.noteService.create([{ title: "Activity note" }]);

    const createLogs = ctx.activityLogRepo.findMany({
      entity_type: "note",
      entity_id: note.id,
    });
    expect(createLogs.some((l) => l.action === "created")).toBe(true);

    ctx.noteService.remove([note.id]);

    const deleteLogs = ctx.activityLogRepo.findMany({
      entity_type: "note",
      entity_id: note.id,
    });
    expect(deleteLogs.some((l) => l.action === "deleted")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe("Edge Cases", () => {
  it("batch creates multiple tasks", () => {
    const tasks = ctx.homeTaskService.create([
      { title: "Batch A" },
      { title: "Batch B" },
      { title: "Batch C" },
    ]);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].title).toBe("Batch A");
    expect(tasks[1].title).toBe("Batch B");
    expect(tasks[2].title).toBe("Batch C");
    // Each should have a unique ID
    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toBe(3);
  });

  it("batch create with one invalid item rejects entire batch", () => {
    const countBefore = ctx.homeTaskService.list({ limit: 200 }).total;

    expect(() =>
      ctx.homeTaskService.create([
        { title: "Valid task in batch" },
        { title: "" }, // invalid
      ])
    ).toThrow(ServiceError);

    const countAfter = ctx.homeTaskService.list({ limit: 200 }).total;
    expect(countAfter).toBe(countBefore);
  });

  it("delete task cascades to schedule deletion (ON DELETE CASCADE)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Cascade task" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-05-01",
    }]);

    ctx.homeTaskService.remove([task.id]);

    // Schedule should be gone
    expect(() => ctx.scheduleService.get(schedule.id)).toThrow(ServiceError);
  });

  it("delete task sets note task_id to null (ON DELETE SET NULL)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "SET NULL task" }]);
    const [note] = ctx.noteService.create([{ title: "SET NULL note", task_id: task.id }]);

    expect(note.task_id).toBe(task.id);

    ctx.homeTaskService.remove([task.id]);

    const fetched = ctx.noteService.get(note.id);
    expect(fetched.task_id).toBeNull();
    // Note still exists, just unlinked
    expect(fetched.title).toBe("SET NULL note");
  });

  it("rejects title over 255 characters", () => {
    expect(() =>
      ctx.homeTaskService.create([{ title: "x".repeat(256) }])
    ).toThrow(ServiceError);
  });

  it("accepts title of exactly 255 characters", () => {
    const title = "a".repeat(255);
    const [task] = ctx.homeTaskService.create([{ title }]);
    expect(task.title.length).toBe(255);
  });

  it("update with invalid status on existing task rejects", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Update enum test" }]);
    expect(() =>
      ctx.homeTaskService.update([{ id: task.id, status: "completed" as any }])
    ).toThrow(ServiceError);
  });
});

// ---------------------------------------------------------------------------
// completeTask Atomicity
// ---------------------------------------------------------------------------

describe("completeTask atomicity", () => {
  it("happy path: all mutations persist atomically (task update + schedule advance + note)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Atomic happy path" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    const result = completeTask(ctx.db, ctx, {
      task_id: task.id,
      note: "Done with this task",
    });

    // Task should be marked done (once schedule)
    expect(result.task.status).toBe("done");
    expect(result.schedule).not.toBeNull();
    expect(result.schedule!.next_due).toBeNull(); // once exhausted
    expect(result.next_due).toBeNull();
    expect(result.completed_at).toBeTruthy();
    expect(result.note_created).not.toBeNull();
    expect(result.note_created!.title).toBe("Completed: Atomic happy path");
    expect(result.note_created!.content).toBe("Done with this task");

    // Verify persisted state
    const fetchedTask = ctx.homeTaskService.get(task.id);
    expect(fetchedTask.status).toBe("done");

    const fetchedSchedule = ctx.scheduleService.get(schedule.id);
    expect(fetchedSchedule.next_due).toBeNull();
    expect(fetchedSchedule.last_completed).toBeTruthy();

    const fetchedNote = ctx.noteService.get(result.note_created!.id);
    expect(fetchedNote.task_id).toBe(task.id);
  });

  it("happy path: recurring task advances schedule without changing task status", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Atomic recurring" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    const result = completeTask(ctx.db, ctx, { task_id: task.id });

    // Task status should remain active (recurring)
    expect(result.task.status).toBe("active");
    expect(result.schedule).not.toBeNull();
    expect(result.next_due).toBeTruthy();
    expect(result.next_due).not.toBe("2026-04-01");
    expect(result.note_created).toBeNull();
  });

  it("happy path: task without schedule is marked done", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Atomic no schedule" }]);

    const result = completeTask(ctx.db, ctx, { task_id: task.id });

    expect(result.task.status).toBe("done");
    expect(result.schedule).toBeNull();
    expect(result.next_due).toBeNull();
  });

  it("rollback: when note creation fails, task and schedule mutations are rolled back", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Atomic rollback test" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    // Save original state
    const originalTask = ctx.homeTaskService.get(task.id);
    const originalSchedule = ctx.scheduleService.get(schedule.id);

    // Force a failure in noteService.create by using the real service with an
    // invalid task_id reference in the note. We need a different approach:
    // monkey-patch noteService.create to throw after task+schedule mutations.
    const originalCreate = ctx.noteService.create.bind(ctx.noteService);
    ctx.noteService.create = () => {
      throw new ServiceError("Simulated note creation failure", 500);
    };

    try {
      expect(() =>
        completeTask(ctx.db, ctx, {
          task_id: task.id,
          note: "This note should fail",
        })
      ).toThrow(ServiceError);

      // Verify rollback: task status should be unchanged
      const fetchedTask = ctx.homeTaskService.get(task.id);
      expect(fetchedTask.status).toBe(originalTask.status);

      // Verify rollback: schedule should be unchanged
      const fetchedSchedule = ctx.scheduleService.get(schedule.id);
      expect(fetchedSchedule.next_due).toBe(originalSchedule.next_due);
      expect(fetchedSchedule.last_completed).toBe(originalSchedule.last_completed);

      // Verify rollback: no activity log entries for the rolled-back mutations
      // (activity logs are inserted by services within the transaction, so they
      // should also be rolled back)
      const taskLogs = ctx.activityLogRepo.findMany({
        entity_type: "home_task",
        entity_id: task.id,
      });
      // Should only have the "created" log, not an "updated" log
      expect(taskLogs.every((l) => l.action !== "updated")).toBe(true);

      const scheduleLogs = ctx.activityLogRepo.findMany({
        entity_type: "schedule",
        entity_id: schedule.id,
      });
      // Should only have the "created" log, not a "completed" log
      expect(scheduleLogs.every((l) => l.action !== "completed")).toBe(true);
    } finally {
      // Restore original method
      ctx.noteService.create = originalCreate;
    }
  });

  it("rollback: when schedule advance fails, task mutation is rolled back", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Atomic schedule fail" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    // Monkey-patch scheduleService.advance to throw
    const originalAdvance = ctx.scheduleService.advance.bind(ctx.scheduleService);
    ctx.scheduleService.advance = () => {
      throw new ServiceError("Simulated schedule advance failure", 500);
    };

    try {
      expect(() =>
        completeTask(ctx.db, ctx, { task_id: task.id })
      ).toThrow(ServiceError);

      // Task status should still be active (the update was rolled back)
      const fetchedTask = ctx.homeTaskService.get(task.id);
      expect(fetchedTask.status).toBe("active");
    } finally {
      ctx.scheduleService.advance = originalAdvance;
    }
  });
});

// ---------------------------------------------------------------------------
// Bug: advance() should compute next_due from previous next_due, not now
// ---------------------------------------------------------------------------

describe("Schedule Advance: reference date correctness", () => {
  it("daily schedule overdue by 5 days: next_due advances from previous next_due, not today", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Overdue daily advance" }]);
    // Set next_due to 5 days ago relative to a known date
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-03-29", // 5 days before 2026-04-03 (today)
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);

    // Should be 2026-03-30 (previous next_due + 1 day), NOT today + 1
    expect(advanced.next_due).toBe("2026-03-30");
    // last_completed should still be today
    expect(advanced.last_completed).toBeTruthy();
  });

  it("monthly schedule due on 1st, completed on 15th: next_due is 1st of next month from original", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Overdue monthly advance" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "monthly",
      recurrence_rule: JSON.stringify({ type: "monthly", day: 1 }),
      next_due: "2026-04-01",
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);

    // From April 1, next monthly (day 1) should be May 1
    expect(advanced.next_due).toBe("2026-05-01");
  });

  it("advance with null next_due on recurring schedule falls back to new Date() without crashing", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Null next_due advance" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    // Manually clear next_due to simulate edge case
    ctx.scheduleService.update([{ id: schedule.id, next_due: null }]);

    // Should not throw, falls back to new Date()
    const advanced = ctx.scheduleService.advance(schedule.id);
    expect(advanced.next_due).toBeTruthy();
    expect(advanced.next_due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("once schedule advance still sets next_due to null (no regression)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Once advance regression" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    const advanced = ctx.scheduleService.advance(schedule.id);
    expect(advanced.next_due).toBeNull();
    expect(advanced.last_completed).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Bug: Paused tasks should not appear in daily summary
// ---------------------------------------------------------------------------

describe("Daily Summary: paused task exclusion", () => {
  it("excludes paused tasks from due_today", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Paused Due Today",
      status: "paused",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    const allItems = [...summary.overdue, ...summary.due_today, ...summary.upcoming];
    expect(allItems.some((i) => i.task.id === task.id)).toBe(false);
  });

  it("excludes paused tasks from overdue", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Paused Overdue",
      status: "paused",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    const allItems = [...summary.overdue, ...summary.due_today, ...summary.upcoming];
    expect(allItems.some((i) => i.task.id === task.id)).toBe(false);
  });

  it("excludes paused tasks from upcoming", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Paused Upcoming",
      status: "paused",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-08",
    }]);

    const summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );

    const allItems = [...summary.overdue, ...summary.due_today, ...summary.upcoming];
    expect(allItems.some((i) => i.task.id === task.id)).toBe(false);
  });

  it("reactivated task appears in summary after unpausing", () => {
    const [task] = ctx.homeTaskService.create([{
      title: "Reactivated Task",
      status: "paused",
    }]);

    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-05",
    }]);

    // While paused, should not appear
    let summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );
    expect([...summary.overdue, ...summary.due_today, ...summary.upcoming]
      .some((i) => i.task.id === task.id)).toBe(false);

    // Reactivate
    ctx.homeTaskService.update([{ id: task.id, status: "active" }]);

    summary = buildDailySummary(
      "2026-04-05",
      7,
      ctx.scheduleRepo,
      ctx.homeTaskRepo,
      ctx.noteRepo,
    );
    expect(summary.due_today.some((i) => i.task.id === task.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug: Schedule type/rule consistency validation
// ---------------------------------------------------------------------------

describe("Schedule type/rule consistency validation", () => {
  it("create: rejects mismatched recurrence_type and recurrence_rule", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Create mismatch" }]);
    expect(() =>
      ctx.scheduleService.create([{
        task_id: task.id,
        recurrence_type: "daily",
        recurrence_rule: JSON.stringify({ type: "weekly", days: [1] }),
        next_due: "2026-05-01",
      }])
    ).toThrow(ServiceError);
  });

  it("create: accepts matching recurrence_type and recurrence_rule", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Create match" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "weekly",
      recurrence_rule: JSON.stringify({ type: "weekly", days: [1] }),
      next_due: "2026-05-01",
    }]);
    expect(schedule.recurrence_type).toBe("weekly");
  });

  it("update: rejects changing recurrence_type to mismatch existing rule", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Update type mismatch" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "weekly",
      recurrence_rule: JSON.stringify({ type: "weekly", days: [1, 3] }),
      next_due: "2026-05-01",
    }]);

    expect(() =>
      ctx.scheduleService.update([{
        id: schedule.id,
        recurrence_type: "daily",
      }])
    ).toThrow(ServiceError);
  });

  it("update: rejects changing recurrence_rule to mismatch existing type", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Update rule mismatch" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "monthly",
      recurrence_rule: JSON.stringify({ type: "monthly", day: 15 }),
      next_due: "2026-05-01",
    }]);

    expect(() =>
      ctx.scheduleService.update([{
        id: schedule.id,
        recurrence_rule: JSON.stringify({ type: "weekly", days: [1] }),
      }])
    ).toThrow(ServiceError);
  });

  it("update: accepts matching type and rule when both updated", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Update both match" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-05-01",
    }]);

    const [updated] = ctx.scheduleService.update([{
      id: schedule.id,
      recurrence_type: "weekly",
      recurrence_rule: JSON.stringify({ type: "weekly", days: [1, 5] }),
    }]);

    expect(updated.recurrence_type).toBe("weekly");
  });

  it("update: setting recurrence_rule to null with type change succeeds", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Update null rule" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-05-01",
    }]);

    // Setting rule to null clears it; type can be anything (no rule to conflict with)
    const [updated] = ctx.scheduleService.update([{
      id: schedule.id,
      recurrence_type: "weekly",
      recurrence_rule: null,
    }]);

    expect(updated.recurrence_type).toBe("weekly");
    expect(updated.recurrence_rule).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bug: completeTask on done/archived tasks should be rejected
// ---------------------------------------------------------------------------

describe("completeTask status guards", () => {
  it("rejects completing a task with status 'done'", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: done task" }]);
    // Complete it first (no schedule -> becomes done)
    completeTask(ctx.db, ctx, { task_id: task.id });
    const fetched = ctx.homeTaskService.get(task.id);
    expect(fetched.status).toBe("done");

    // Second completion should fail
    expect(() => completeTask(ctx.db, ctx, { task_id: task.id })).toThrow(ServiceError);
    try {
      completeTask(ctx.db, ctx, { task_id: task.id });
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).statusCode).toBe(400);
      expect((e as ServiceError).message).toContain("done");
    }
  });

  it("rejects completing a task with status 'archived'", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: archived task" }]);
    ctx.homeTaskService.update([{ id: task.id, status: "archived" }]);

    expect(() => completeTask(ctx.db, ctx, { task_id: task.id })).toThrow(ServiceError);
    try {
      completeTask(ctx.db, ctx, { task_id: task.id });
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).statusCode).toBe(400);
      expect((e as ServiceError).message).toContain("archived");
    }
  });

  it("rejects completing a task with status 'paused'", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: paused task" }]);
    ctx.homeTaskService.update([{ id: task.id, status: "paused" }]);

    expect(() => completeTask(ctx.db, ctx, { task_id: task.id })).toThrow(ServiceError);
    try {
      completeTask(ctx.db, ctx, { task_id: task.id });
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).statusCode).toBe(400);
      expect((e as ServiceError).message).toContain("paused");
    }
  });

  it("allows completing an active task (no regression)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: active task OK" }]);
    const result = completeTask(ctx.db, ctx, { task_id: task.id });
    expect(result.task.status).toBe("done");
  });

  it("allows repeated completion of recurring task (stays active)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: recurring OK" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    // First completion -- task stays active
    const result1 = completeTask(ctx.db, ctx, { task_id: task.id });
    expect(result1.task.status).toBe("active");

    // Second completion -- should succeed because task is still active
    const result2 = completeTask(ctx.db, ctx, { task_id: task.id });
    expect(result2.task.status).toBe("active");
  });

  it("no activity log entries created when completion is rejected (guard fires before mutations)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Guard: no side effects" }]);
    // Complete it (no schedule -> done)
    completeTask(ctx.db, ctx, { task_id: task.id });

    // Count activity logs before rejected attempt
    const logsBefore = ctx.activityLogRepo.findMany({
      entity_type: "home_task",
      entity_id: task.id,
    });

    // Attempt to complete again (should fail)
    expect(() => completeTask(ctx.db, ctx, { task_id: task.id })).toThrow(ServiceError);

    // Activity log count should not have changed
    const logsAfter = ctx.activityLogRepo.findMany({
      entity_type: "home_task",
      entity_id: task.id,
    });
    expect(logsAfter.length).toBe(logsBefore.length);
  });
});

// ---------------------------------------------------------------------------
// Bug: Deleting a task should emit cascade events for schedule and notes
// ---------------------------------------------------------------------------

describe("Task deletion cascade events", () => {
  it("emits schedule deleted event when deleting a task with a schedule", () => {
    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    const [task] = ctx.homeTaskService.create([{ title: "Cascade: schedule" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-10",
    }]);

    events.length = 0; // clear create events

    ctx.homeTaskService.remove([task.id]);

    // Should have: home_task deleted, schedule deleted
    const scheduleDeletedEvents = events.filter(
      (e: any) => e.type === "deleted" && e.entity_type === "schedule"
    );
    expect(scheduleDeletedEvents.length).toBe(1);
    expect(scheduleDeletedEvents[0].ids).toContain(schedule.id);

    unsub();
  });

  it("emits note updated event when deleting a task with linked notes", () => {
    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    const [task] = ctx.homeTaskService.create([{ title: "Cascade: notes" }]);
    const [note] = ctx.noteService.create([{
      title: "Linked note",
      content: "Some content",
      task_id: task.id,
    }]);

    events.length = 0;

    ctx.homeTaskService.remove([task.id]);

    // Should have: home_task deleted, note updated (task_id set to null)
    const noteUpdatedEvents = events.filter(
      (e: any) => e.type === "updated" && e.entity_type === "note"
    );
    expect(noteUpdatedEvents.length).toBe(1);
    const updatedNote = noteUpdatedEvents[0].payload.find((n: any) => n.id === note.id);
    expect(updatedNote).toBeTruthy();
    expect(updatedNote.task_id).toBeNull();

    unsub();
  });

  it("does not emit extra events when deleting a task with no schedule or notes", () => {
    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    const [task] = ctx.homeTaskService.create([{ title: "Cascade: nothing" }]);
    events.length = 0;

    ctx.homeTaskService.remove([task.id]);

    // Should only have the home_task deleted event
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("deleted");
    expect(events[0].entity_type).toBe("home_task");

    unsub();
  });

  it("creates activity log entries for cascade-deleted schedules", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Cascade: activity log" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-10",
    }]);

    ctx.homeTaskService.remove([task.id]);

    const scheduleLogs = ctx.activityLogRepo.findMany({
      entity_type: "schedule",
      entity_id: schedule.id,
    });
    const deletedLog = scheduleLogs.find((l) => l.action === "deleted");
    expect(deletedLog).toBeTruthy();
    expect(JSON.parse(deletedLog!.summary)).toEqual({ reason: "cascade_from_task" });
  });

  it("emits both schedule and note events when task has both", () => {
    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    const [task] = ctx.homeTaskService.create([{ title: "Cascade: both" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-10",
    }]);
    const [note] = ctx.noteService.create([{
      title: "Both note",
      task_id: task.id,
    }]);

    events.length = 0;

    ctx.homeTaskService.remove([task.id]);

    const scheduleEvents = events.filter(
      (e: any) => e.type === "deleted" && e.entity_type === "schedule"
    );
    const noteEvents = events.filter(
      (e: any) => e.type === "updated" && e.entity_type === "note"
    );

    expect(scheduleEvents.length).toBe(1);
    expect(scheduleEvents[0].ids).toContain(schedule.id);
    expect(noteEvents.length).toBe(1);
    expect(noteEvents[0].payload[0].id).toBe(note.id);
    expect(noteEvents[0].payload[0].task_id).toBeNull();

    unsub();
  });
});

// ---------------------------------------------------------------------------
// Bug: Date string semantic validation
// ---------------------------------------------------------------------------

describe("Date string semantic validation", () => {
  it("rejects schedule creation with next_due 2024-02-30", () => {
    const [task] = ctx.homeTaskService.create([{ title: "DateVal: Feb30" }]);
    expect(() =>
      ctx.scheduleService.create([{
        task_id: task.id,
        recurrence_type: "once",
        next_due: "2024-02-30",
      }])
    ).toThrow(ServiceError);
  });

  it("rejects schedule update with next_due 2024-02-30", () => {
    const [task] = ctx.homeTaskService.create([{ title: "DateVal: Update Feb30" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2024-06-15",
    }]);
    expect(() =>
      ctx.scheduleService.update([{
        id: schedule.id,
        next_due: "2024-02-30",
      }])
    ).toThrow(ServiceError);
  });

  it("accepts schedule creation with next_due 2024-02-29 (leap year)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "DateVal: Leap" }]);
    const [schedule] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2024-02-29",
    }]);
    expect(schedule.next_due).toBe("2024-02-29");
  });
});

// ---------------------------------------------------------------------------
// Bug: LIKE pattern escape in title filter
// ---------------------------------------------------------------------------

describe("LIKE pattern escape", () => {
  it("title filter with underscore matches only literal underscore", () => {
    ctx.homeTaskService.create([{ title: "a_b pattern" }]);
    ctx.homeTaskService.create([{ title: "aXb pattern" }]);

    const result = ctx.homeTaskService.list({ title: "a_b" });
    const titles = result.data.map((t) => t.title);
    expect(titles).toContain("a_b pattern");
    expect(titles).not.toContain("aXb pattern");
  });

  it("title filter with percent matches only literal percent", () => {
    ctx.homeTaskService.create([{ title: "100%done task" }]);
    ctx.homeTaskService.create([{ title: "100done task" }]);

    const result = ctx.homeTaskService.list({ title: "100%" });
    const titles = result.data.map((t) => t.title);
    expect(titles).toContain("100%done task");
    expect(titles).not.toContain("100done task");
  });

  it("note title filter with underscore matches only literal underscore", () => {
    ctx.noteService.create([{ title: "note_a_b" }]);
    ctx.noteService.create([{ title: "note_aXb" }]);

    const result = ctx.noteService.list({ title: "a_b" });
    const titles = result.data.map((n) => n.title);
    expect(titles).toContain("note_a_b");
    expect(titles).not.toContain("note_aXb");
  });
});

// ---------------------------------------------------------------------------
// Bug: Delete count accuracy
// ---------------------------------------------------------------------------

describe("Delete count accuracy", () => {
  it("returns actual deletion count for tasks (partial match)", () => {
    const [t1] = ctx.homeTaskService.create([{ title: "DelCount: exists" }]);
    const deleted = ctx.homeTaskService.remove([t1.id, "nonexistent-id-123"]);
    expect(deleted).toBe(1);
  });

  it("returns 0 when deleting nonexistent task IDs", () => {
    const deleted = ctx.homeTaskService.remove(["nonexistent-a", "nonexistent-b"]);
    expect(deleted).toBe(0);
  });

  it("returns 0 for empty ids array", () => {
    const deleted = ctx.homeTaskService.remove([]);
    expect(deleted).toBe(0);
  });

  it("returns actual deletion count for notes", () => {
    const [n1] = ctx.noteService.create([{ title: "DelCount note" }]);
    const deleted = ctx.noteService.remove([n1.id, "nonexistent-note-123"]);
    expect(deleted).toBe(1);
  });

  it("returns actual deletion count for schedules", () => {
    const [task] = ctx.homeTaskService.create([{ title: "DelCount sched task" }]);
    const [sched] = ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-06-01",
    }]);
    const deleted = ctx.scheduleService.remove([sched.id, "nonexistent-sched-123"]);
    expect(deleted).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Bug: EventBus buffering in completeTask
// ---------------------------------------------------------------------------

describe("EventBus buffering in completeTask", () => {
  it("successful completeTask emits events after transaction commits", () => {
    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    const [task] = ctx.homeTaskService.create([{ title: "Buffer: success" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "daily",
      recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }),
      next_due: "2026-04-01",
    }]);

    events.length = 0; // clear create events

    completeTask(ctx.db, ctx, { task_id: task.id });

    // Events should have been emitted (schedule advance emits an updated event)
    expect(events.length).toBeGreaterThanOrEqual(1);
    const scheduleUpdated = events.find(
      (e: any) => e.type === "updated" && e.entity_type === "schedule"
    );
    expect(scheduleUpdated).toBeTruthy();

    unsub();
  });

  it("failed completeTask emits zero events (rollback discards buffer)", () => {
    const [task] = ctx.homeTaskService.create([{ title: "Buffer: rollback" }]);
    ctx.scheduleService.create([{
      task_id: task.id,
      recurrence_type: "once",
      next_due: "2026-04-01",
    }]);

    // Monkey-patch noteService.create to throw after task+schedule mutations
    const originalCreate = ctx.noteService.create.bind(ctx.noteService);
    ctx.noteService.create = () => {
      throw new ServiceError("Simulated note creation failure", 500);
    };

    const events: any[] = [];
    const unsub = ctx.eventBus.subscribe((e: any) => events.push(e));

    try {
      expect(() =>
        completeTask(ctx.db, ctx, {
          task_id: task.id,
          note: "This note should fail",
        })
      ).toThrow(ServiceError);

      // No events should have been emitted — the buffer was discarded on rollback
      expect(events.length).toBe(0);
    } finally {
      ctx.noteService.create = originalCreate;
      unsub();
    }
  });
});
