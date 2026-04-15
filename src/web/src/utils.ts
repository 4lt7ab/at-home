/**
 * Shared utility functions for the web UI.
 */

/**
 * Format a UTC midnight ISO string as a human-readable date.
 * Uses UTC timezone to prevent date-shifting in western timezones.
 */
export function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Convert a Date object (from a DatePicker, local timezone) to midnight UTC ISO string.
 * Uses local year/month/day since DatePickers produce local dates.
 */
export function dateToDayUtcIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
}

/**
 * Convert a UTC midnight ISO string to a local Date with the same calendar date.
 * Without this, `new Date("2026-04-15T00:00:00.000Z")` in UTC-5 gives a local
 * Date of April 14 at 7pm -- wrong day for date-only values.
 */
export function utcIsoToLocalDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Date range for "today" using the LOCAL calendar date.
 *
 * Dates are stored via dateToDayUtcIso which encodes the LOCAL date at midnight
 * UTC. So "today" bounds must also use the local date, not UTC date, or the
 * two will disagree when the local day differs from the UTC day.
 */
export function getTodayBounds(): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    start: dateToDayUtcIso(today),
    end: new Date(new Date(dateToDayUtcIso(tomorrow)).getTime() - 1).toISOString(),
  };
}

/**
 * Date range for a week relative to today, using the LOCAL calendar date.
 * weeksFromNow=0 is the current week (Sun-Sat), weeksFromNow=1 is next week.
 */
export function getWeekBounds(weeksFromNow: number): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // local day of week: 0=Sun … 6=Sat
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + weeksFromNow * 7);
  const nextSunday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 7);
  return {
    start: dateToDayUtcIso(sunday),
    end: new Date(new Date(dateToDayUtcIso(nextSunday)).getTime() - 1).toISOString(),
  };
}
