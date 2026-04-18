import type { Note, NoteSummary, Reminder, ReminderSummary, Log, LogSummary, LogEntry, LogEntryReaction, LogEntrySummary } from "./entities";
import type {
  CreateNoteInput,
  UpdateNoteInput,
  CreateReminderInput,
  UpdateReminderInput,
  DismissReminderInput,
  CreateLogInput,
  UpdateLogInput,
  CreateLogEntryInput,
  UpdateLogEntryInput,
} from "./inputs";
import type { ReminderFilter } from "./repositories/reminders";
import type { LogFilter } from "./repositories/logs";
import type { LogEntryFilter } from "./repositories/log-entries";

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

export interface ILogService {
  list(filter?: LogFilter): Promise<Paginated<LogSummary>>;
  get(id: string): Promise<Log>;
  create(inputs: CreateLogInput[]): Promise<Log[]>;
  update(inputs: UpdateLogInput[]): Promise<Log[]>;
  remove(ids: string[]): Promise<number>;
}

export interface ILogEntryService {
  list(filter?: LogEntryFilter): Promise<Paginated<LogEntrySummary>>;
  get(id: string): Promise<LogEntry>;
  create(inputs: CreateLogEntryInput[]): Promise<LogEntry[]>;
  update(inputs: UpdateLogEntryInput[]): Promise<LogEntry[]>;
  remove(ids: string[]): Promise<number>;
  applyReaction(log_entry_id: string, emoji: string): Promise<LogEntryReaction>;
}
