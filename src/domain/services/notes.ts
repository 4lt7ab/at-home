import type { Note, NoteSummary } from "../entities";
import { toNoteSummary } from "../entities";
import type { CreateNoteInput, UpdateNoteInput } from "../inputs";
import type { INoteService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { NoteRepository } from "../repositories/notes";
import type { EventBus } from "../events";

export class NoteService implements INoteService {
  constructor(
    private noteRepo: NoteRepository,
    private eventBus: EventBus,
  ) {}

  async list(filter?: { id?: string; title?: string; limit?: number; offset?: number }): Promise<Paginated<NoteSummary>> {
    const [data, total] = await Promise.all([
      this.noteRepo.findMany(filter),
      this.noteRepo.count(filter),
    ]);
    return { data: data.map(toNoteSummary), total };
  }

  async get(id: string): Promise<Note> {
    const note = await this.noteRepo.findById(id);
    if (!note) throw new ServiceError("note not found", 404);
    return note;
  }

  async create(inputs: CreateNoteInput[]): Promise<Note[]> {
    for (const input of inputs) {
      if (!input.title?.trim()) {
        throw new ServiceError("title is required", 400);
      }
      if (input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.context !== undefined && input.context.length > 50000) {
        throw new ServiceError("context must be 50000 characters or fewer", 400);
      }
    }

    const rows = inputs.map((input) => ({
      title: input.title,
      context: input.context ?? null,
    }));

    const notes = await this.noteRepo.insertMany(rows);
    this.eventBus.emit({ type: "created", entity_type: "note", payload: notes });
    return notes;
  }

  async update(inputs: UpdateNoteInput[]): Promise<Note[]> {
    for (const input of inputs) {
      const existing = await this.noteRepo.findById(input.id);
      if (!existing) throw new ServiceError(`note not found: ${input.id}`, 404);

      if (input.title !== undefined && !input.title.trim()) {
        throw new ServiceError("title cannot be empty", 400);
      }
      if (input.title !== undefined && input.title.length > 255) {
        throw new ServiceError("title must be 255 characters or fewer", 400);
      }
      if (input.context !== undefined && input.context !== null && input.context.length > 50000) {
        throw new ServiceError("context must be 50000 characters or fewer", 400);
      }
    }

    const notes = await this.noteRepo.updateMany(inputs);
    this.eventBus.emit({ type: "updated", entity_type: "note", payload: notes });
    return notes;
  }

  async remove(ids: string[]): Promise<number> {
    const deleted = await this.noteRepo.deleteMany(ids);
    this.eventBus.emit({ type: "deleted", entity_type: "note", ids });
    return deleted;
  }
}
