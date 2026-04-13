import type { Note, NoteSummary, Reminder, ReminderSummary } from "./entities";
import type { CreateNoteInput, UpdateNoteInput, CreateReminderInput, UpdateReminderInput, DismissReminderInput } from "./inputs";
import type { ReminderFilter } from "./repositories/reminders";

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

export interface IReminderService {
  list(filter?: ReminderFilter): Promise<Paginated<ReminderSummary>>;
  get(id: string): Promise<Reminder>;
  create(inputs: CreateReminderInput[]): Promise<Reminder[]>;
  update(inputs: UpdateReminderInput[]): Promise<Reminder[]>;
  remove(ids: string[]): Promise<number>;
  dismiss(input: DismissReminderInput): Promise<Reminder>;
}
