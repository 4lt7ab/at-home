import { type HomeTask, type HomeTaskSummary, toHomeTaskSummary, TASK_STATUSES, AREAS, EFFORT_LEVELS } from "../entities";
import type { CreateHomeTaskInput, UpdateHomeTaskInput } from "../inputs";
import type { IHomeTaskService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { HomeTaskRepository } from "../repositories/home-tasks";
import type { ScheduleRepository } from "../repositories/schedules";
import type { NoteRepository } from "../repositories/notes";
import type { ActivityLogRepository } from "../repositories/activity-log";
import type { EventBus } from "../events";

export class HomeTaskService implements IHomeTaskService {
  constructor(
    private homeTaskRepo: HomeTaskRepository,
    private scheduleRepo: ScheduleRepository,
    private noteRepo: NoteRepository,
    private activityLog: ActivityLogRepository,
    private eventBus: EventBus,
  ) {}

  list(filter?: { id?: string; status?: string; area?: string; effort?: string; title?: string; limit?: number; offset?: number }): Paginated<HomeTaskSummary> {
    return {
      data: this.homeTaskRepo.findMany(filter).map(toHomeTaskSummary),
      total: this.homeTaskRepo.count(filter),
    };
  }

  get(id: string): HomeTask {
    const task = this.homeTaskRepo.findById(id);
    if (!task) throw new ServiceError("home task not found", 404);
    return task;
  }

  create(inputs: CreateHomeTaskInput[]): HomeTask[] {
    for (const input of inputs) {
      if (!input.title?.trim()) {
        throw new ServiceError("title is required", 400);
      }
      if (input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.description !== undefined && input.description.length > 10000) {
        throw new ServiceError("description must be 10000 characters or fewer", 400);
      }
      if (input.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(input.status)) {
        throw new ServiceError(`status must be one of: ${(TASK_STATUSES as readonly string[]).join(", ")}`, 400);
      }
      if (input.area !== undefined && !(AREAS as readonly string[]).includes(input.area)) {
        throw new ServiceError(`area must be one of: ${(AREAS as readonly string[]).join(", ")}`, 400);
      }
      if (input.effort !== undefined && !(EFFORT_LEVELS as readonly string[]).includes(input.effort)) {
        throw new ServiceError(`effort must be one of: ${(EFFORT_LEVELS as readonly string[]).join(", ")}`, 400);
      }
    }

    const rows = inputs.map((input) => ({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "active" as const,
      area: input.area ?? null,
      effort: input.effort ?? null,
    }));

    const tasks = this.homeTaskRepo.insertMany(rows);
    for (const t of tasks) {
      this.activityLog.insert({
        entity_type: "home_task",
        entity_id: t.id,
        action: "created",
        summary: JSON.stringify({ title: t.title }),
      });
    }
    this.eventBus.emit({ type: "created", entity_type: "home_task", payload: tasks });
    return tasks;
  }

  update(inputs: UpdateHomeTaskInput[]): HomeTask[] {
    for (const input of inputs) {
      if (input.title !== undefined && !input.title.trim()) {
        throw new ServiceError("title cannot be empty", 400);
      }
      if (input.title !== undefined && input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.description !== undefined && input.description !== null && input.description.length > 10000) {
        throw new ServiceError("description must be 10000 characters or fewer", 400);
      }
      if (input.status !== undefined && !(TASK_STATUSES as readonly string[]).includes(input.status)) {
        throw new ServiceError(`status must be one of: ${(TASK_STATUSES as readonly string[]).join(", ")}`, 400);
      }
      if (input.area !== undefined && input.area !== null && !(AREAS as readonly string[]).includes(input.area)) {
        throw new ServiceError(`area must be one of: ${(AREAS as readonly string[]).join(", ")}`, 400);
      }
      if (input.effort !== undefined && input.effort !== null && !(EFFORT_LEVELS as readonly string[]).includes(input.effort)) {
        throw new ServiceError(`effort must be one of: ${(EFFORT_LEVELS as readonly string[]).join(", ")}`, 400);
      }
      const existing = this.homeTaskRepo.findById(input.id);
      if (!existing) throw new ServiceError(`home task not found: ${input.id}`, 404);
    }

    const tasks = this.homeTaskRepo.updateMany(inputs);
    for (const t of tasks) {
      const fields = Object.keys(inputs.find((i) => i.id === t.id) ?? {}).filter((k) => k !== "id");
      this.activityLog.insert({
        entity_type: "home_task",
        entity_id: t.id,
        action: "updated",
        summary: JSON.stringify({ fields }),
      });
    }
    this.eventBus.emit({ type: "updated", entity_type: "home_task", payload: tasks });
    return tasks;
  }

  remove(ids: string[]): number {
    // Collect cascade-affected entities BEFORE deletion
    const affectedScheduleIds: string[] = [];
    const affectedNoteIds: string[] = [];
    for (const id of ids) {
      const schedule = this.scheduleRepo.findByTaskId(id);
      if (schedule) affectedScheduleIds.push(schedule.id);
      const notes = this.noteRepo.findByTaskId(id);
      affectedNoteIds.push(...notes.map(n => n.id));
    }

    const deleted = this.homeTaskRepo.deleteMany(ids);
    for (const id of ids) {
      this.activityLog.insert({
        entity_type: "home_task",
        entity_id: id,
        action: "deleted",
        summary: JSON.stringify({}),
      });
    }
    this.eventBus.emit({ type: "deleted", entity_type: "home_task", ids });

    // Emit cascade events for schedules (ON DELETE CASCADE)
    if (affectedScheduleIds.length > 0) {
      this.eventBus.emit({ type: "deleted", entity_type: "schedule", ids: affectedScheduleIds });
      for (const sid of affectedScheduleIds) {
        this.activityLog.insert({
          entity_type: "schedule",
          entity_id: sid,
          action: "deleted",
          summary: JSON.stringify({ reason: "cascade_from_task" }),
        });
      }
    }

    // Emit cascade events for notes (ON DELETE SET NULL -- notes still exist with task_id = null)
    if (affectedNoteIds.length > 0) {
      const updatedNotes = affectedNoteIds.map(nid => this.noteRepo.findById(nid)).filter(Boolean);
      if (updatedNotes.length > 0) {
        this.eventBus.emit({ type: "updated", entity_type: "note", payload: updatedNotes });
      }
    }

    return deleted;
  }
}
