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

// -- Log inputs -------------------------------------------------------------

export interface CreateLogInput {
  name: string;
  description?: string | null;
}

export interface UpdateLogInput {
  id: string;
  name?: string;
  description?: string | null;
}

export interface CreateLogEntryInput {
  log_id: string;
  occurred_at?: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateLogEntryInput {
  id: string;
  occurred_at?: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}
