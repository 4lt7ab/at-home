import { type Season, SEASONS } from "./entities.js";
import { ServiceError } from "./errors.js";

// -- Recurrence Rule discriminated union ------------------------------------

export type RecurrenceRule =
  | { type: "once"; date: string }
  | { type: "daily"; interval: number }
  | { type: "weekly"; days: number[]; interval?: number }
  | { type: "monthly"; day: number; interval?: number }
  | {
      type: "seasonal";
      season: Season;
      month: number;
      day: number;
    }
  | { type: "custom"; interval_days: number };

// -- Helpers: local date manipulation ---------------------------------------

/** Strip time component — returns a Date at midnight local time for the given YYYY-MM-DD. */
function toLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseISODate(s: string): Date {
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

/** Last day of a given month (1-indexed month, like Date.getMonth()+1). */
function lastDayOfMonth(year: number, month: number): number {
  // new Date(year, month, 0) gives the last day of the previous month,
  // so passing month (1-indexed) gives last day of that month.
  return new Date(year, month, 0).getDate();
}

/** Clamp a day-of-month to the actual last day of the target month. */
function clampDay(year: number, month: number, day: number): number {
  const max = lastDayOfMonth(year, month);
  return Math.min(day, max);
}

// -- Date validation --------------------------------------------------------

/** Check that a YYYY-MM-DD string represents a real calendar date. */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// -- Validation helpers -----------------------------------------------------

const VALID_TYPES = new Set([
  "once",
  "daily",
  "weekly",
  "monthly",
  "seasonal",
  "custom",
]);

function fail(msg: string): never {
  throw new ServiceError(msg, 400);
}

function validateRule(rule: unknown): RecurrenceRule {
  if (typeof rule !== "object" || rule === null || !("type" in rule)) {
    fail("Invalid recurrence rule: missing type field");
  }

  const r = rule as Record<string, unknown>;

  if (!VALID_TYPES.has(r.type as string)) {
    fail(`Invalid recurrence rule: unknown type '${String(r.type)}'`);
  }

  switch (r.type) {
    case "once": {
      if (typeof r.date !== "string" || !isValidDateString(r.date)) {
        fail("Invalid recurrence rule: 'once' requires a valid date in YYYY-MM-DD format");
      }
      return { type: "once", date: r.date };
    }

    case "daily": {
      if (typeof r.interval !== "number" || r.interval < 1 || !Number.isInteger(r.interval)) {
        fail("Invalid recurrence rule: 'daily' requires a positive integer interval");
      }
      if (r.interval > 3650) {
        fail("Invalid recurrence rule: 'daily' interval must not exceed 3650 (~10 years)");
      }
      return { type: "daily", interval: r.interval };
    }

    case "weekly": {
      if (!Array.isArray(r.days) || r.days.length === 0) {
        fail("Invalid recurrence rule: 'weekly' requires a non-empty days array");
      }
      for (const d of r.days) {
        if (typeof d !== "number" || d < 0 || d > 6 || !Number.isInteger(d)) {
          fail("Invalid recurrence rule: 'weekly' days must be integers 0-6 (Sun-Sat)");
        }
      }
      const interval = r.interval ?? 1;
      if (typeof interval !== "number" || interval < 1 || !Number.isInteger(interval)) {
        fail("Invalid recurrence rule: 'weekly' interval must be a positive integer");
      }
      if (interval > 520) {
        fail("Invalid recurrence rule: 'weekly' interval must not exceed 520 (~10 years)");
      }
      return {
        type: "weekly",
        days: [...(r.days as number[])].sort((a, b) => a - b),
        ...(interval !== 1 ? { interval } : {}),
      };
    }

    case "monthly": {
      if (typeof r.day !== "number" || r.day < 1 || r.day > 31 || !Number.isInteger(r.day)) {
        fail("Invalid recurrence rule: 'monthly' requires day as integer 1-31");
      }
      const interval = r.interval ?? 1;
      if (typeof interval !== "number" || interval < 1 || !Number.isInteger(interval)) {
        fail("Invalid recurrence rule: 'monthly' interval must be a positive integer");
      }
      if (interval > 120) {
        fail("Invalid recurrence rule: 'monthly' interval must not exceed 120 (10 years)");
      }
      return {
        type: "monthly",
        day: r.day,
        ...(interval !== 1 ? { interval } : {}),
      };
    }

    case "seasonal": {
      if (typeof r.season !== "string" || !(SEASONS as readonly string[]).includes(r.season)) {
        fail(`Invalid recurrence rule: 'seasonal' requires season as one of ${SEASONS.join(", ")}`);
      }
      if (typeof r.month !== "number" || r.month < 1 || r.month > 12 || !Number.isInteger(r.month)) {
        fail("Invalid recurrence rule: 'seasonal' requires month as integer 1-12");
      }
      if (typeof r.day !== "number" || r.day < 1 || r.day > 31 || !Number.isInteger(r.day)) {
        fail("Invalid recurrence rule: 'seasonal' requires day as integer 1-31");
      }
      return {
        type: "seasonal",
        season: r.season as Season,
        month: r.month,
        day: r.day,
      };
    }

    case "custom": {
      if (
        typeof r.interval_days !== "number" ||
        r.interval_days < 1 ||
        !Number.isInteger(r.interval_days)
      ) {
        fail("Invalid recurrence rule: 'custom' requires a positive integer interval_days");
      }
      if (r.interval_days > 3650) {
        fail("Invalid recurrence rule: 'custom' interval_days must not exceed 3650 (~10 years)");
      }
      return { type: "custom", interval_days: r.interval_days };
    }

    default:
      fail(`Invalid recurrence rule: unknown type '${String(r.type)}'`);
  }
}

// -- parseRule / serializeRule -----------------------------------------------

/** Parse a JSON string into a validated RecurrenceRule. Throws ServiceError on invalid input. */
export function parseRule(json: string): RecurrenceRule {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    fail("Invalid recurrence rule: malformed JSON");
  }
  return validateRule(parsed);
}

/** Serialize a RecurrenceRule to a JSON string. */
export function serializeRule(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

// -- nextDue() --------------------------------------------------------------

/**
 * Given a recurrence rule and a reference date (`after`), compute the next
 * due date on or after `after`.
 *
 * Returns null if no future occurrence exists (e.g., a 'once' rule whose date
 * has already passed).
 *
 * All calculations use local dates (no time component).
 */
export function nextDue(rule: RecurrenceRule, after: Date): Date | null {
  const ref = toLocalDate(after);

  switch (rule.type) {
    case "once":
      return nextDueOnce(rule, ref);
    case "daily":
      return nextDueDaily(rule.interval, ref);
    case "weekly":
      return nextDueWeekly(rule, ref);
    case "monthly":
      return nextDueMonthly(rule, ref);
    case "seasonal":
      return nextDueSeasonal(rule, ref);
    case "custom":
      return nextDueDaily(rule.interval_days, ref);
  }
}

function nextDueOnce(rule: { date: string }, ref: Date): Date | null {
  const target = parseISODate(rule.date);
  return target >= ref ? target : null;
}

function nextDueDaily(interval: number, ref: Date): Date {
  const result = new Date(ref);
  result.setDate(result.getDate() + interval);
  return result;
}

function nextDueWeekly(
  rule: { days: number[]; interval?: number },
  ref: Date
): Date {
  const interval = rule.interval ?? 1;
  const sortedDays = [...rule.days].sort((a, b) => a - b);
  const refDay = ref.getDay(); // 0=Sun..6=Sat

  // First, check if there's a matching day later in the current week.
  // Only valid when interval is 1 (every week is a matching week).
  // For interval > 1, skip the same-week scan entirely — the next
  // occurrence must be `interval` weeks away.
  if (interval === 1) {
    for (const day of sortedDays) {
      if (day > refDay) {
        const result = new Date(ref);
        result.setDate(result.getDate() + (day - refDay));
        return result;
      }
    }
  }

  // No matching day left in this week. Advance to the next interval-th week.
  // The next interval-th week starts on the Sunday that is `interval` weeks
  // after the current week's Sunday.
  const daysUntilNextSunday = 7 - refDay;
  const daysToAdvance = daysUntilNextSunday + (interval - 1) * 7;
  const nextWeekSunday = new Date(ref);
  nextWeekSunday.setDate(nextWeekSunday.getDate() + daysToAdvance);

  // Return the first matching day in that week
  const firstDay = sortedDays[0];
  const result = new Date(nextWeekSunday);
  result.setDate(result.getDate() + firstDay);
  return result;
}

function nextDueMonthly(
  rule: { day: number; interval?: number },
  ref: Date
): Date {
  const interval = rule.interval ?? 1;
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth() + 1; // 1-indexed
  const refDay = ref.getDate();

  // Check if the target day in the current month is still on or after ref
  const clampedCurrentDay = clampDay(refYear, refMonth, rule.day);
  if (clampedCurrentDay > refDay) {
    return new Date(refYear, refMonth - 1, clampedCurrentDay);
  }

  // Otherwise advance by `interval` months (O(1) modular arithmetic)
  let targetMonth = refMonth + interval;
  let targetYear = refYear;
  targetYear += Math.floor((targetMonth - 1) / 12);
  targetMonth = ((targetMonth - 1) % 12) + 1;

  const clampedDay = clampDay(targetYear, targetMonth, rule.day);
  return new Date(targetYear, targetMonth - 1, clampedDay);
}

function nextDueSeasonal(
  rule: { month: number; day: number },
  ref: Date
): Date {
  const refYear = ref.getFullYear();

  // Try this year first
  const clampedDay = clampDay(refYear, rule.month, rule.day);
  const thisYear = new Date(refYear, rule.month - 1, clampedDay);
  if (thisYear >= ref) {
    return thisYear;
  }

  // Otherwise next year
  const nextYear = refYear + 1;
  const clampedDayNext = clampDay(nextYear, rule.month, rule.day);
  return new Date(nextYear, rule.month - 1, clampedDayNext);
}

// -- recurrenceLabel --------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

/**
 * Returns a human-readable description for a recurrence rule JSON string.
 * Returns an empty string if the rule is null/undefined or cannot be parsed.
 */
export function recurrenceLabel(ruleJson: string | null): string {
  if (!ruleJson) return "";
  let rule: RecurrenceRule;
  try {
    rule = parseRule(ruleJson);
  } catch {
    return "";
  }

  switch (rule.type) {
    case "once":
      return `Once on ${rule.date}`;
    case "daily":
      return rule.interval === 1
        ? "Daily"
        : `Every ${rule.interval} days`;
    case "weekly": {
      const interval = rule.interval ?? 1;
      const dayNames = rule.days.map((d) => DAY_NAMES[d]);
      const prefix = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
      return `${prefix} on ${dayNames.join(", ")}`;
    }
    case "monthly": {
      const interval = rule.interval ?? 1;
      const prefix = interval === 1 ? "Monthly" : `Every ${interval} months`;
      return `${prefix} on day ${rule.day}`;
    }
    case "seasonal":
      return `${SEASON_LABELS[rule.season]} (${rule.month}/${rule.day})`;
    case "custom":
      return `Every ${rule.interval_days} days`;
  }
}

// -- isOverdue / daysOverdue ------------------------------------------------

/**
 * Returns true if `nextDueDate` (YYYY-MM-DD) is before `asOf` (defaults to today).
 */
export function isOverdue(nextDueDate: string, asOf?: Date): boolean {
  const due = parseISODate(nextDueDate);
  const ref = toLocalDate(asOf ?? new Date());
  return due < ref;
}

/**
 * Returns the number of whole days that `nextDueDate` is past due relative
 * to `asOf` (defaults to today). Returns 0 if not overdue.
 */
export function daysOverdue(nextDueDate: string, asOf?: Date): number {
  const due = parseISODate(nextDueDate);
  const ref = toLocalDate(asOf ?? new Date());
  if (due >= ref) return 0;
  // Use UTC epoch days to avoid DST-induced errors (spring-forward = 23h day)
  const utcDue = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const utcRef = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.floor((utcRef - utcDue) / (24 * 60 * 60 * 1000));
}
