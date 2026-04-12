import type { HomeTask, HomeTaskSummary, Note, NoteSummary, NoteType, Schedule, ScheduleSummary } from "./entities";
import type {
  CreateHomeTaskInput,
  UpdateHomeTaskInput,
  CreateNoteInput,
  UpdateNoteInput,
  CreateScheduleInput,
  UpdateScheduleInput,
} from "./inputs";

export interface Paginated<T> {
  data: T[];
  total: number;
}

export interface IHomeTaskService {
  list(filter?: { id?: string; status?: string; area?: string; effort?: string; title?: string; limit?: number; offset?: number }): Promise<Paginated<HomeTaskSummary>>;
  get(id: string): Promise<HomeTask>;
  create(inputs: CreateHomeTaskInput[]): Promise<HomeTask[]>;
  update(inputs: UpdateHomeTaskInput[]): Promise<HomeTask[]>;
  remove(ids: string[]): Promise<number>;
}

export interface INoteService {
  list(filter?: { id?: string; task_id?: string; title?: string; note_type?: NoteType; limit?: number; offset?: number }): Promise<Paginated<NoteSummary>>;
  get(id: string): Promise<Note>;
  create(inputs: CreateNoteInput[]): Promise<Note[]>;
  update(inputs: UpdateNoteInput[]): Promise<Note[]>;
  remove(ids: string[]): Promise<number>;
}

export interface IScheduleService {
  list(filter?: { id?: string; task_id?: string; recurrence_type?: string; limit?: number; offset?: number }): Promise<Paginated<ScheduleSummary>>;
  get(id: string): Promise<Schedule>;
  create(inputs: CreateScheduleInput[]): Promise<Schedule[]>;
  update(inputs: UpdateScheduleInput[]): Promise<Schedule[]>;
  remove(ids: string[]): Promise<number>;
  advance(id: string): Promise<Schedule>;
}
