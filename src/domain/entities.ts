// -- Entity interfaces ------------------------------------------------------

export interface Note {
  id: string;
  title: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export type Recurrence = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Reminder {
  id: string;
  context: string;
  remind_at: string;
  recurrence: Recurrence | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

// -- Summary types (projections for list responses) -------------------------

export interface NoteSummary {
  id: string;
  title: string;
  has_context: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderSummary {
  id: string;
  context: string;
  context_preview: string;
  remind_at: string;
  recurrence: Recurrence | null;
  dismissed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -- Summary mappers --------------------------------------------------------

export function toNoteSummary(n: Note): NoteSummary {
  return {
    id: n.id,
    title: n.title,
    has_context: n.context != null,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

// -- Log entities -----------------------------------------------------------

export interface Log {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  log_id: string;
  occurred_at: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntryReaction {
  log_entry_id: string;
  emoji: string;
  count: number;
  created_at: string;
  updated_at: string;
}

export interface LogSummary {
  id: string;
  name: string;
  description: string | null;
  last_logged_at: string | null;
  entry_count: number;
  created_at: string;
  updated_at: string;
}

export interface LogEntrySummary {
  id: string;
  log_id: string;
  occurred_at: string;
  note: string | null;
  note_preview: string | null;
  has_metadata: boolean;
  reactions: Array<{ emoji: string; count: number }>;
  created_at: string;
  updated_at: string;
}

export function toLogSummary(
  l: Log,
  projections: { last_logged_at: string | null; entry_count: number },
): LogSummary {
  return {
    id: l.id,
    name: l.name,
    description: l.description,
    last_logged_at: projections.last_logged_at,
    entry_count: projections.entry_count,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

export function toLogEntrySummary(
  e: LogEntry,
  reactions: Array<{ emoji: string; count: number }> = [],
): LogEntrySummary {
  return {
    id: e.id,
    log_id: e.log_id,
    occurred_at: e.occurred_at,
    note: e.note,
    note_preview: e.note == null
      ? null
      : (e.note.length > 100 ? e.note.slice(0, 100) + "…" : e.note),
    has_metadata: e.metadata != null && Object.keys(e.metadata).length > 0,
    reactions,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

export function toReminderSummary(r: Reminder): ReminderSummary {
  const isActive = r.dismissed_at == null || r.dismissed_at < r.remind_at;
  return {
    id: r.id,
    context: r.context,
    context_preview: r.context.length > 100 ? r.context.slice(0, 100) + "…" : r.context,
    remind_at: r.remind_at,
    recurrence: r.recurrence,
    dismissed_at: r.dismissed_at,
    is_active: isActive,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
