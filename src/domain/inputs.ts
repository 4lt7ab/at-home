import type { Recurrence } from "./entities";

export interface CreateNoteInput {
  title: string;
  context?: string;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  context?: string | null;
}

export interface CreateReminderInput {
  context: string;
  remind_at: string;
  recurrence?: Recurrence;
}

export interface UpdateReminderInput {
  id: string;
  context?: string;
  remind_at?: string;
  recurrence?: Recurrence | null;
}

export interface DismissReminderInput {
  id: string;
  remind_at?: string;
}
