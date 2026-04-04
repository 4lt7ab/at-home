import type { Database } from "bun:sqlite";
import type { HomeTask, Note, Schedule } from "../entities";
import type { IHomeTaskService, INoteService, IScheduleService } from "../services";
import type { EventBus } from "../events";
import { ServiceError } from "../errors";

export interface CompleteTaskInput {
  task_id: string;
  note?: string;
}

export interface CompleteTaskResult {
  task: HomeTask;
  schedule: Schedule | null;
  next_due: string | null;
  completed_at: string;
  note_created: Note | null;
}

export interface CompleteTaskServices {
  homeTaskService: IHomeTaskService;
  noteService: INoteService;
  scheduleService: IScheduleService;
  eventBus: EventBus;
}

/**
 * Atomically complete a task: update task status, advance schedule, and
 * optionally create a completion note -- all within a single SQLite transaction.
 *
 * If any step throws, all prior mutations (including activity log entries)
 * are rolled back.
 */
export function completeTask(
  db: Database,
  services: CompleteTaskServices,
  input: CompleteTaskInput,
): CompleteTaskResult {
  const { homeTaskService, noteService, scheduleService, eventBus } = services;
  const { task_id, note } = input;

  const run = db.transaction(() => {
    // 1. Get the task (throws 404 if missing)
    const task = homeTaskService.get(task_id);

    // Guard: reject completion of done, archived, or paused tasks
    if (task.status === "done" || task.status === "archived") {
      throw new ServiceError(
        `cannot complete task with status '${task.status}'`,
        400,
      );
    }
    if (task.status === "paused") {
      throw new ServiceError(
        "Cannot complete a paused task — resume it first",
        400,
      );
    }

    // 2. Find the schedule for this task (if any)
    const scheduleResult = scheduleService.list({ task_id, limit: 1 });
    const scheduleSummary = scheduleResult.data[0] ?? null;

    let updatedTask = task;
    let updatedSchedule: Schedule | null = null;
    let nextDue: string | null = null;

    if (!scheduleSummary) {
      // No schedule -- just mark the task as done
      [updatedTask] = homeTaskService.update([{ id: task_id, status: "done" }]);
    } else {
      // Fetch the full schedule entity
      const schedule = scheduleService.get(scheduleSummary.id);

      if (schedule.recurrence_type === "once") {
        // One-off: mark task done + advance schedule (sets next_due to null)
        [updatedTask] = homeTaskService.update([{ id: task_id, status: "done" }]);
        updatedSchedule = scheduleService.advance(schedule.id);
      } else {
        // Recurring: do NOT change task status, just advance the schedule
        updatedSchedule = scheduleService.advance(schedule.id);
      }

      nextDue = updatedSchedule?.next_due ?? null;
    }

    // 3. Optionally create a completion note
    let noteCreated: Note | null = null;
    if (note) {
      const [created] = noteService.create([
        {
          title: `Completed: ${task.title}`,
          content: note,
          task_id,
        },
      ]);
      noteCreated = created;
    }

    return {
      task: updatedTask,
      schedule: updatedSchedule,
      next_due: nextDue,
      completed_at: new Date().toISOString(),
      note_created: noteCreated,
    };
  });

  // Buffer events during the transaction so they only fire on commit,
  // not during mid-transaction where a rollback would leave phantom events.
  eventBus.startBuffer();
  try {
    const result = run();
    eventBus.flush();
    return result;
  } catch (err) {
    eventBus.discard();
    throw err;
  }
}
