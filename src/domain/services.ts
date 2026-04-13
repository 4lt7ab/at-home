import type { Note, NoteSummary } from "./entities";
import type { CreateNoteInput, UpdateNoteInput } from "./inputs";

export interface Paginated<T> {
  data: T[];
  total: number;
}

export interface INoteService {
  list(filter?: { id?: string; title?: string; limit?: number; offset?: number }): Promise<Paginated<NoteSummary>>;
  get(id: string): Promise<Note>;
  create(inputs: CreateNoteInput[]): Promise<Note[]>;
  update(inputs: UpdateNoteInput[]): Promise<Note[]>;
  remove(ids: string[]): Promise<number>;
}
