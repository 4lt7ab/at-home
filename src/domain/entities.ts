// -- Entity interfaces ------------------------------------------------------

export interface Note {
  id: string;
  title: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export type Recurrence = 'weekly' | 'monthly' | 'yearly';

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
