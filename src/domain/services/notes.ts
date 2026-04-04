import type { Note, NoteSummary, NoteType } from "../entities";
import { toNoteSummary, NOTE_TYPES } from "../entities";
import type { CreateNoteInput, UpdateNoteInput } from "../inputs";
import type { INoteService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { NoteRepository } from "../repositories/notes";
import type { HomeTaskRepository } from "../repositories/home-tasks";
import type { ActivityLogRepository } from "../repositories/activity-log";
import type { EventBus } from "../events";

export class NoteService implements INoteService {
  constructor(
    private noteRepo: NoteRepository,
    private homeTaskRepo: HomeTaskRepository,
    private activityLog: ActivityLogRepository,
    private eventBus: EventBus,
  ) {}

  list(filter?: { id?: string; task_id?: string; title?: string; note_type?: NoteType; limit?: number; offset?: number }): Paginated<NoteSummary> {
    return {
      data: this.noteRepo.findMany(filter).map(toNoteSummary),
      total: this.noteRepo.count(filter),
    };
  }

  get(id: string): Note {
    const note = this.noteRepo.findById(id);
    if (!note) throw new ServiceError("note not found", 404);
    return note;
  }

  create(inputs: CreateNoteInput[]): Note[] {
    for (const input of inputs) {
      if (!input.title?.trim()) {
        throw new ServiceError("title is required", 400);
      }
      if (input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.content !== undefined && input.content.length > 50000) {
        throw new ServiceError("content must be 50000 characters or fewer", 400);
      }
      if (input.task_id !== undefined && input.task_id !== null) {
        const task = this.homeTaskRepo.findById(input.task_id);
        if (!task) {
          throw new ServiceError(`home_task not found: ${input.task_id}`, 404);
        }
      }
      if (input.note_type !== undefined && !(NOTE_TYPES as readonly string[]).includes(input.note_type)) {
        throw new ServiceError(`invalid note_type: ${input.note_type}`, 400);
      }
    }

    const rows = inputs.map((input) => ({
      task_id: input.task_id ?? null,
      title: input.title,
      content: input.content ?? null,
      note_type: input.note_type ?? "manual",
    }));

    const notes = this.noteRepo.insertMany(rows);
    for (const n of notes) {
      this.activityLog.insert({
        entity_type: "note",
        entity_id: n.id,
        action: "created",
        summary: JSON.stringify({ title: n.title, task_id: n.task_id }),
      });
    }
    this.eventBus.emit({ type: "created", entity_type: "note", payload: notes });
    return notes;
  }

  update(inputs: UpdateNoteInput[]): Note[] {
    for (const input of inputs) {
      const existing = this.noteRepo.findById(input.id);
      if (!existing) throw new ServiceError(`note not found: ${input.id}`, 404);

      if (input.title !== undefined && !input.title.trim()) {
        throw new ServiceError("title cannot be empty", 400);
      }
      if (input.title !== undefined && input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.content !== undefined && input.content !== null && input.content.length > 50000) {
        throw new ServiceError("content must be 50000 characters or fewer", 400);
      }
      if (input.task_id !== undefined && input.task_id !== null) {
        const task = this.homeTaskRepo.findById(input.task_id);
        if (!task) {
          throw new ServiceError(`home_task not found: ${input.task_id}`, 404);
        }
      }
      // task_id === null is allowed (unlinking from task)
    }

    const notes = this.noteRepo.updateMany(inputs);
    for (const n of notes) {
      const fields = Object.keys(inputs.find((i) => i.id === n.id) ?? {}).filter((k) => k !== "id");
      this.activityLog.insert({
        entity_type: "note",
        entity_id: n.id,
        action: "updated",
        summary: JSON.stringify({ fields }),
      });
    }
    this.eventBus.emit({ type: "updated", entity_type: "note", payload: notes });
    return notes;
  }

  remove(ids: string[]): number {
    const deleted = this.noteRepo.deleteMany(ids);
    for (const id of ids) {
      this.activityLog.insert({
        entity_type: "note",
        entity_id: id,
        action: "deleted",
        summary: JSON.stringify({}),
      });
    }
    this.eventBus.emit({ type: "deleted", entity_type: "note", ids });
    return deleted;
  }
}
