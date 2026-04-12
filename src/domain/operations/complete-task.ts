import type { Sql } from "../db/connection";
import type { HomeTask, Note, Schedule } from "../entities";
import type { IHomeTaskService, INoteService, IScheduleService } from "../services";
import type { ActivityLogRepository } from "../repositories/activity-log";
import type { EventBus } from "../events";
import { ServiceError } from "../errors";
import { HomeTaskRepository } from "../repositories/home-tasks";
import { NoteRepository } from "../repositories/notes";
import { ScheduleRepository } from "../repositories/schedules";
import { HomeTaskService } from "../services/home-tasks";
import { NoteService } from "../services/notes";
import { ScheduleService } from "../services/schedules";
import { ActivityLogRepository as ActivityLogRepo } from "../repositories/activity-log";

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
  activityLogRepo: ActivityLogRepository;
  eventBus: EventBus;
}

/**
 * Atomically complete a task: update task status, advance schedule, and
 * optionally create a completion note -- all within a single Postgres transaction.
 *
 * Creates transaction-scoped repos and services so all mutations use the same
 * transaction connection. If any step throws, all mutations are rolled back.
 */
export async function completeTask(
  sql: Sql,
  services: CompleteTaskServices,
  input: CompleteTaskInput,
): Promise<CompleteTaskResult> {
  const { eventBus } = services;
  const { task_id, note } = input;

  // Buffer events during the transaction so they only fire on commit
  eventBus.startBuffer();
  try {
    const result = await sql.begin(async (tx) => {
      // Create transaction-scoped repos and services
      const txHomeTaskRepo = new HomeTaskRepository(tx);
      const txNoteRepo = new NoteRepository(tx);
      const txScheduleRepo = new ScheduleRepository(tx);
      const txActivityLogRepo = new ActivityLogRepo(tx);

      const txHomeTaskService = new HomeTaskService(txHomeTaskRepo, txScheduleRepo, txNoteRepo, txActivityLogRepo, eventBus);
      const txNoteService = new NoteService(txNoteRepo, txHomeTaskRepo, txActivityLogRepo, eventBus);
      const txScheduleService = new ScheduleService(txScheduleRepo, txHomeTaskRepo, txActivityLogRepo, eventBus);

      // 1. Get the task (throws 404 if missing)
      const task = await txHomeTaskService.get(task_id);

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
      const scheduleResult = await txScheduleService.list({ task_id, limit: 1 });
      const scheduleSummary = scheduleResult.data[0] ?? null;

      let updatedTask = task;
      let updatedSchedule: Schedule | null = null;
      let nextDue: string | null = null;

      if (!scheduleSummary) {
        [updatedTask] = await txHomeTaskService.update([{ id: task_id, status: "done" }]);
      } else {
        const schedule = await txScheduleService.get(scheduleSummary.id);

        if (schedule.recurrence_type === "once") {
          [updatedTask] = await txHomeTaskService.update([{ id: task_id, status: "done" }]);
          updatedSchedule = await txScheduleService.advance(schedule.id);
        } else {
          updatedSchedule = await txScheduleService.advance(schedule.id);
        }

        nextDue = updatedSchedule?.next_due ?? null;
      }

      // 3. Optionally create a completion note
      let noteCreated: Note | null = null;
      if (note) {
        const [created] = await txNoteService.create([
          {
            title: `Completed: ${task.title}`,
            content: note,
            task_id,
            note_type: "completion",
          },
        ]);
        noteCreated = created;
      }

      // 4. Log completion activity
      const completedAt = new Date().toISOString();
      await txActivityLogRepo.insert({
        entity_type: "home_task",
        entity_id: task_id,
        action: "completed",
        summary: JSON.stringify({
          next_due: nextDue,
          last_completed: updatedSchedule?.last_completed ?? completedAt.slice(0, 10),
          note_id: noteCreated?.id ?? null,
        }),
      });

      return {
        task: updatedTask,
        schedule: updatedSchedule,
        next_due: nextDue,
        completed_at: completedAt,
        note_created: noteCreated,
      };
    });

    eventBus.flush();
    return result;
  } catch (err) {
    eventBus.discard();
    throw err;
  }
}
