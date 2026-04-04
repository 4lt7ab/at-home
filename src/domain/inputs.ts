import type { TaskStatus, Area, EffortLevel, RecurrenceType, NoteType } from './entities';

export interface CreateHomeTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  area?: Area;
  effort?: EffortLevel;
}

export interface UpdateHomeTaskInput {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  area?: Area | null;
  effort?: EffortLevel | null;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  task_id?: string;
  note_type?: NoteType;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string | null;
  task_id?: string | null;
}

export interface CreateScheduleInput {
  task_id: string;
  recurrence_type: RecurrenceType;
  recurrence_rule?: string;
  next_due?: string;
}

export interface UpdateScheduleInput {
  id: string;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: string | null;
  next_due?: string | null;
  last_completed?: string | null;
}
