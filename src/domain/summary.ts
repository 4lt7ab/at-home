import type { HomeTaskSummary, NoteSummary, ScheduleSummary } from "./entities.js";
import { toHomeTaskSummary, toNoteSummary, toScheduleSummary } from "./entities.js";
import { daysOverdue as calcDaysOverdue, recurrenceLabel } from "./recurrence.js";
import type { HomeTaskRepository } from "./repositories/home-tasks.js";
import type { NoteRepository } from "./repositories/notes.js";
import type { ScheduleRepository } from "./repositories/schedules.js";

// -- Types ------------------------------------------------------------------

export interface DailySummaryItem {
  task: HomeTaskSummary;
  schedule: ScheduleSummary;
  notes: NoteSummary[];
  days_overdue: number;
  recurrence_label: string;
}

export interface DailySummary {
  date: string;
  overdue: DailySummaryItem[];
  due_today: DailySummaryItem[];
  upcoming: DailySummaryItem[];
  counts: { overdue: number; due_today: number; upcoming: number; total: number };
}

// -- Helpers ----------------------------------------------------------------

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD. */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add a number of days to a YYYY-MM-DD string, returning a new YYYY-MM-DD string. */
function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// -- buildDailySummary ------------------------------------------------------

export async function buildDailySummary(
  date: string,
  lookaheadDays: number,
  scheduleRepo: ScheduleRepository,
  taskRepo: HomeTaskRepository,
  noteRepo: NoteRepository,
): Promise<DailySummary> {
  const dueOrOverdueSchedules = await scheduleRepo.findDueOrOverdue(date);

  const endDate = addDays(date, lookaheadDays);
  const upcomingSchedules = await scheduleRepo.findUpcoming(date, endDate);

  const overdue: DailySummaryItem[] = [];
  const dueToday: DailySummaryItem[] = [];

  const asOfDate = parseDate(date);

  for (const schedule of dueOrOverdueSchedules) {
    const task = await taskRepo.findById(schedule.task_id);

    if (!task || task.status === "done" || task.status === "archived" || task.status === "paused") {
      continue;
    }

    const notes = await noteRepo.findByTaskId(schedule.task_id);
    const daysOver = schedule.next_due ? calcDaysOverdue(schedule.next_due, asOfDate) : 0;
    const label = recurrenceLabel(schedule.recurrence_rule);

    const item: DailySummaryItem = {
      task: toHomeTaskSummary(task),
      schedule: toScheduleSummary(schedule),
      notes: notes.map(toNoteSummary),
      days_overdue: daysOver,
      recurrence_label: label,
    };

    if (schedule.next_due && schedule.next_due < date) {
      overdue.push(item);
    } else {
      dueToday.push(item);
    }
  }

  const upcoming: DailySummaryItem[] = [];

  for (const schedule of upcomingSchedules) {
    const task = await taskRepo.findById(schedule.task_id);

    if (!task || task.status === "done" || task.status === "archived" || task.status === "paused") {
      continue;
    }

    const notes = await noteRepo.findByTaskId(schedule.task_id);
    const label = recurrenceLabel(schedule.recurrence_rule);

    upcoming.push({
      task: toHomeTaskSummary(task),
      schedule: toScheduleSummary(schedule),
      notes: notes.map(toNoteSummary),
      days_overdue: 0,
      recurrence_label: label,
    });
  }

  overdue.sort((a, b) => b.days_overdue - a.days_overdue);
  dueToday.sort((a, b) => a.task.title.localeCompare(b.task.title));
  upcoming.sort((a, b) => {
    const aDue = a.schedule.next_due ?? "";
    const bDue = b.schedule.next_due ?? "";
    return aDue.localeCompare(bDue);
  });

  return {
    date,
    overdue,
    due_today: dueToday,
    upcoming,
    counts: {
      overdue: overdue.length,
      due_today: dueToday.length,
      upcoming: upcoming.length,
      total: overdue.length + dueToday.length + upcoming.length,
    },
  };
}
