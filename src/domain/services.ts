import type { HomeTask, HomeTaskSummary, Note, NoteSummary, Schedule, ScheduleSummary } from "./entities";
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
  list(filter?: { id?: string; status?: string; area?: string; effort?: string; title?: string; limit?: number; offset?: number }): Paginated<HomeTaskSummary>;
  get(id: string): HomeTask;
  create(inputs: CreateHomeTaskInput[]): HomeTask[];
  update(inputs: UpdateHomeTaskInput[]): HomeTask[];
  remove(ids: string[]): number;
}

export interface INoteService {
  list(filter?: { id?: string; task_id?: string; title?: string; limit?: number; offset?: number }): Paginated<NoteSummary>;
  get(id: string): Note;
  create(inputs: CreateNoteInput[]): Note[];
  update(inputs: UpdateNoteInput[]): Note[];
  remove(ids: string[]): number;
}

export interface IScheduleService {
  list(filter?: { id?: string; task_id?: string; recurrence_type?: string; limit?: number; offset?: number }): Paginated<ScheduleSummary>;
  get(id: string): Schedule;
  create(inputs: CreateScheduleInput[]): Schedule[];
  update(inputs: UpdateScheduleInput[]): Schedule[];
  remove(ids: string[]): number;
  advance(id: string): Schedule;
}
