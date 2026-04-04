// -- Value arrays & derived union types ------------------------------------

export const TASK_STATUSES = ['active', 'paused', 'done', 'archived'] as const;
export const AREAS = ['kitchen', 'bathroom', 'bedroom', 'living_room', 'garage', 'yard', 'basement', 'attic', 'office', 'exterior', 'hvac', 'plumbing', 'electrical', 'general'] as const;
export const EFFORT_LEVELS = ['trivial', 'low', 'medium', 'high'] as const;
export const RECURRENCE_TYPES = ['once', 'daily', 'weekly', 'monthly', 'seasonal', 'custom'] as const;
export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export const ENTITY_TYPES = ['home_task', 'note', 'schedule'] as const;
export const NOTE_TYPES = ['manual', 'completion'] as const;
export const ACTIVITY_ACTIONS = ['created', 'updated', 'deleted', 'completed'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type Area = typeof AREAS[number];
export type EffortLevel = typeof EFFORT_LEVELS[number];
export type RecurrenceType = typeof RECURRENCE_TYPES[number];
export type Season = typeof SEASONS[number];
export type EntityType = typeof ENTITY_TYPES[number];
export type NoteType = typeof NOTE_TYPES[number];
export type ActivityAction = typeof ACTIVITY_ACTIONS[number];

// -- Entity interfaces ------------------------------------------------------

export interface HomeTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  area: Area | null;
  effort: EffortLevel | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  task_id: string | null;
  title: string;
  content: string | null;
  note_type: NoteType;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  task_id: string;
  recurrence_type: RecurrenceType;
  recurrence_rule: string | null;
  next_due: string | null;
  last_completed: string | null;
  created_at: string;
  updated_at: string;
}

// -- Activity log -----------------------------------------------------------

export interface ActivityLog {
  id: string;
  entity_type: EntityType;
  entity_id: string | null;
  action: ActivityAction;
  summary: string;
  created_at: string;
}

// -- Summary types (projections for list responses) -------------------------

export interface HomeTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  area: Area | null;
  effort: EffortLevel | null;
  has_description: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteSummary {
  id: string;
  task_id: string | null;
  title: string;
  has_content: boolean;
  note_type: NoteType;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSummary {
  id: string;
  task_id: string;
  recurrence_type: RecurrenceType;
  next_due: string | null;
  last_completed: string | null;
  created_at: string;
  updated_at: string;
}

// -- Summary mappers --------------------------------------------------------

export function toHomeTaskSummary(t: HomeTask): HomeTaskSummary {
  return {
    id: t.id, title: t.title, status: t.status,
    area: t.area, effort: t.effort,
    has_description: t.description != null,
    created_at: t.created_at, updated_at: t.updated_at,
  };
}

export function toNoteSummary(n: Note): NoteSummary {
  return {
    id: n.id, task_id: n.task_id, title: n.title,
    has_content: n.content != null,
    note_type: n.note_type,
    created_at: n.created_at, updated_at: n.updated_at,
  };
}

export function toScheduleSummary(s: Schedule): ScheduleSummary {
  return {
    id: s.id, task_id: s.task_id,
    recurrence_type: s.recurrence_type,
    next_due: s.next_due, last_completed: s.last_completed,
    created_at: s.created_at, updated_at: s.updated_at,
  };
}
