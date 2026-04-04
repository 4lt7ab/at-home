import { describe, it, expect } from "bun:test";
import {
  nextDue,
  parseRule,
  serializeRule,
  isOverdue,
  daysOverdue,
  recurrenceLabel,
  isValidDateString,
} from "./recurrence";
import type { RecurrenceRule } from "./recurrence";

/** Helper: parse a YYYY-MM-DD string into a local-midnight Date. */
const d = (s: string): Date => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};

/** Helper: format a Date as YYYY-MM-DD for easy assertion. */
const fmt = (date: Date | null): string | null =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : null;

// =============================================================================
// parseRule / serializeRule
// =============================================================================

describe("parseRule", () => {
  it("parses a valid 'once' rule", () => {
    const rule = parseRule('{"type":"once","date":"2025-06-15"}');
    expect(rule).toEqual({ type: "once", date: "2025-06-15" });
  });

  it("parses a valid 'daily' rule", () => {
    const rule = parseRule('{"type":"daily","interval":3}');
    expect(rule).toEqual({ type: "daily", interval: 3 });
  });

  it("parses a valid 'weekly' rule with days array", () => {
    const rule = parseRule('{"type":"weekly","days":[1,3,5]}');
    expect(rule).toEqual({ type: "weekly", days: [1, 3, 5] });
  });

  it("parses a valid 'weekly' rule and sorts days", () => {
    const rule = parseRule('{"type":"weekly","days":[5,1,3]}');
    expect(rule).toEqual({ type: "weekly", days: [1, 3, 5] });
  });

  it("parses a valid 'weekly' rule with interval", () => {
    const rule = parseRule('{"type":"weekly","days":[1],"interval":2}');
    expect(rule).toEqual({ type: "weekly", days: [1], interval: 2 });
  });

  it("parses a valid 'monthly' rule", () => {
    const rule = parseRule('{"type":"monthly","day":15}');
    expect(rule).toEqual({ type: "monthly", day: 15 });
  });

  it("parses a valid 'monthly' rule with interval", () => {
    const rule = parseRule('{"type":"monthly","day":1,"interval":3}');
    expect(rule).toEqual({ type: "monthly", day: 1, interval: 3 });
  });

  it("parses a valid 'seasonal' rule", () => {
    const rule = parseRule(
      '{"type":"seasonal","season":"spring","month":3,"day":15}'
    );
    expect(rule).toEqual({
      type: "seasonal",
      season: "spring",
      month: 3,
      day: 15,
    });
  });

  it("parses a valid 'custom' rule", () => {
    const rule = parseRule('{"type":"custom","interval_days":45}');
    expect(rule).toEqual({ type: "custom", interval_days: 45 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseRule("not json")).toThrow("malformed JSON");
  });

  it("throws on missing type field", () => {
    expect(() => parseRule('{"interval":1}')).toThrow("missing type field");
  });

  it("throws on unknown type", () => {
    expect(() => parseRule('{"type":"biannual"}')).toThrow("unknown type");
  });

  it("throws on weekly with empty days array", () => {
    expect(() => parseRule('{"type":"weekly","days":[]}')).toThrow(
      "non-empty days array"
    );
  });

  it("throws on daily with interval=0", () => {
    expect(() => parseRule('{"type":"daily","interval":0}')).toThrow(
      "positive integer interval"
    );
  });

  it("throws on daily with negative interval", () => {
    expect(() => parseRule('{"type":"daily","interval":-1}')).toThrow(
      "positive integer interval"
    );
  });

  it("throws on daily with non-integer interval", () => {
    expect(() => parseRule('{"type":"daily","interval":1.5}')).toThrow(
      "positive integer interval"
    );
  });

  it("throws on monthly with day=0", () => {
    expect(() => parseRule('{"type":"monthly","day":0}')).toThrow(
      "day as integer 1-31"
    );
  });

  it("throws on monthly with day=32", () => {
    expect(() => parseRule('{"type":"monthly","day":32}')).toThrow(
      "day as integer 1-31"
    );
  });

  it("throws on custom with interval_days=0", () => {
    expect(() => parseRule('{"type":"custom","interval_days":0}')).toThrow(
      "positive integer interval_days"
    );
  });

  it("throws on weekly with invalid day value", () => {
    expect(() => parseRule('{"type":"weekly","days":[7]}')).toThrow(
      "integers 0-6"
    );
  });

  // -- Interval upper-bound caps --

  it("accepts daily interval at cap (3650)", () => {
    const rule = parseRule('{"type":"daily","interval":3650}');
    expect(rule).toEqual({ type: "daily", interval: 3650 });
  });

  it("rejects daily interval above cap (3651)", () => {
    expect(() => parseRule('{"type":"daily","interval":3651}')).toThrow(
      "must not exceed 3650"
    );
  });

  it("accepts weekly interval at cap (520)", () => {
    const rule = parseRule('{"type":"weekly","days":[1],"interval":520}');
    expect(rule).toEqual({ type: "weekly", days: [1], interval: 520 });
  });

  it("rejects weekly interval above cap (521)", () => {
    expect(() => parseRule('{"type":"weekly","days":[1],"interval":521}')).toThrow(
      "must not exceed 520"
    );
  });

  it("accepts monthly interval at cap (120)", () => {
    const rule = parseRule('{"type":"monthly","day":1,"interval":120}');
    expect(rule).toEqual({ type: "monthly", day: 1, interval: 120 });
  });

  it("rejects monthly interval above cap (121)", () => {
    expect(() => parseRule('{"type":"monthly","day":1,"interval":121}')).toThrow(
      "must not exceed 120"
    );
  });

  it("accepts custom interval_days at cap (3650)", () => {
    const rule = parseRule('{"type":"custom","interval_days":3650}');
    expect(rule).toEqual({ type: "custom", interval_days: 3650 });
  });

  it("rejects custom interval_days above cap (3651)", () => {
    expect(() => parseRule('{"type":"custom","interval_days":3651}')).toThrow(
      "must not exceed 3650"
    );
  });

  // -- Semantic date validation for 'once' type --

  it("rejects once rule with impossible date 2024-02-30", () => {
    expect(() => parseRule('{"type":"once","date":"2024-02-30"}')).toThrow(
      "valid date"
    );
  });

  it("rejects once rule with month 13", () => {
    expect(() => parseRule('{"type":"once","date":"2024-13-01"}')).toThrow(
      "valid date"
    );
  });

  it("rejects once rule with month 0", () => {
    expect(() => parseRule('{"type":"once","date":"2024-00-15"}')).toThrow(
      "valid date"
    );
  });

  it("rejects once rule with Feb 29 in non-leap year", () => {
    expect(() => parseRule('{"type":"once","date":"2023-02-29"}')).toThrow(
      "valid date"
    );
  });

  it("accepts once rule with Feb 29 in leap year 2024", () => {
    const rule = parseRule('{"type":"once","date":"2024-02-29"}');
    expect(rule).toEqual({ type: "once", date: "2024-02-29" });
  });
});

describe("serializeRule", () => {
  it("round-trips a 'once' rule", () => {
    const rule: RecurrenceRule = { type: "once", date: "2025-06-15" };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });

  it("round-trips a 'daily' rule", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 7 };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });

  it("round-trips a 'weekly' rule", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1, 3, 5] };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });

  it("round-trips a 'monthly' rule", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15 };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });

  it("round-trips a 'seasonal' rule", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "winter",
      month: 12,
      day: 1,
    };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });

  it("round-trips a 'custom' rule", () => {
    const rule: RecurrenceRule = { type: "custom", interval_days: 90 };
    expect(parseRule(serializeRule(rule))).toEqual(rule);
  });
});

// =============================================================================
// nextDue — once
// =============================================================================

describe("nextDue: once", () => {
  it("returns the date when it is in the future", () => {
    const rule: RecurrenceRule = { type: "once", date: "2025-06-15" };
    expect(fmt(nextDue(rule, d("2025-01-01")))).toBe("2025-06-15");
  });

  it("returns the date when 'after' is the same day", () => {
    const rule: RecurrenceRule = { type: "once", date: "2025-06-15" };
    expect(fmt(nextDue(rule, d("2025-06-15")))).toBe("2025-06-15");
  });

  it("returns null when the date is in the past", () => {
    const rule: RecurrenceRule = { type: "once", date: "2025-06-15" };
    expect(nextDue(rule, d("2025-07-01"))).toBeNull();
  });
});

// =============================================================================
// nextDue — daily
// =============================================================================

describe("nextDue: daily", () => {
  it("interval=1 returns the next day", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 1 };
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-11");
  });

  it("interval=3 returns 3 days later", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 3 };
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-13");
  });

  it("crosses month boundary correctly", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 1 };
    expect(fmt(nextDue(rule, d("2025-01-31")))).toBe("2025-02-01");
  });

  it("crosses year boundary correctly", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 1 };
    expect(fmt(nextDue(rule, d("2025-12-31")))).toBe("2026-01-01");
  });

  it("returns ref + interval even when ref is in the past (documents contract for advance)", () => {
    const rule: RecurrenceRule = { type: "daily", interval: 1 };
    // nextDue is a pure function: ref in the past still returns ref + interval
    expect(fmt(nextDue(rule, d("2020-01-01")))).toBe("2020-01-02");
  });
});

// =============================================================================
// nextDue — weekly
// =============================================================================

describe("nextDue: weekly", () => {
  // 2025-03-10 is a Monday (day 1)
  // 2025-03-11 is a Tuesday (day 2)
  // 2025-03-12 is a Wednesday (day 3)
  // 2025-03-14 is a Friday (day 5)
  // 2025-03-15 is a Saturday (day 6)

  it("single day (Monday), after is Wednesday -> returns next Monday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1] }; // Monday
    // Wednesday 2025-03-12, next Monday is 2025-03-17
    expect(fmt(nextDue(rule, d("2025-03-12")))).toBe("2025-03-17");
  });

  it("single day (Wednesday), after is Monday -> returns this Wednesday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [3] }; // Wednesday
    // Monday 2025-03-10, next Wednesday is 2025-03-12
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-12");
  });

  it("multiple days [Mon, Wed, Fri], after is Tuesday -> returns Wednesday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1, 3, 5] };
    // Tuesday 2025-03-11, next matching day is Wednesday 2025-03-12
    expect(fmt(nextDue(rule, d("2025-03-11")))).toBe("2025-03-12");
  });

  it("multiple days [Mon, Wed, Fri], after is Saturday -> returns Monday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1, 3, 5] };
    // Saturday 2025-03-15, next matching day is Monday 2025-03-17
    expect(fmt(nextDue(rule, d("2025-03-15")))).toBe("2025-03-17");
  });

  it("multiple days [Mon, Wed, Fri], after is Friday -> returns Monday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1, 3, 5] };
    // Friday 2025-03-14, no day > 5 in the list, next week Monday 2025-03-17
    expect(fmt(nextDue(rule, d("2025-03-14")))).toBe("2025-03-17");
  });

  it("single day, after IS that day -> returns next week same day", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1] }; // Monday
    // Monday 2025-03-10 -> next Monday 2025-03-17
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-17");
  });

  it("interval=2 (biweekly): skips one week", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [1], interval: 2 };
    // Saturday 2025-03-15: no remaining day this week (1 < 6).
    // Skip to 2 weeks' Sunday from this week's Sunday.
    // This week's Sunday is 2025-03-09. daysUntilNextSunday = 7-6=1, advance = 1 + (2-1)*7 = 8.
    // Next target Sunday = 2025-03-23. First matching day = Monday = 2025-03-24.
    expect(fmt(nextDue(rule, d("2025-03-15")))).toBe("2025-03-24");
  });

  it("interval=2 with multiple days", () => {
    const rule: RecurrenceRule = {
      type: "weekly",
      days: [1, 5],
      interval: 2,
    };
    // Friday 2025-03-14 (day 5): no day > 5 in the list.
    // daysUntilNextSunday = 7-5=2, advance = 2 + (2-1)*7 = 9.
    // Next target Sunday = 2025-03-23. First matching day = Monday = 2025-03-24.
    expect(fmt(nextDue(rule, d("2025-03-14")))).toBe("2025-03-24");
  });

  it("Sunday (day 0) in the days list, after is Saturday", () => {
    const rule: RecurrenceRule = { type: "weekly", days: [0] }; // Sunday
    // Saturday 2025-03-15 -> next Sunday is 2025-03-16
    expect(fmt(nextDue(rule, d("2025-03-15")))).toBe("2025-03-16");
  });

  // -- interval > 1 same-week edge cases (bug: same-week scan should be skipped) --

  it("interval=2 on [Wed], ref=Monday: skips same-week Wed, returns Wed 2 weeks later", () => {
    // 2025-03-10 is a Monday (day 1)
    const rule: RecurrenceRule = { type: "weekly", days: [3], interval: 2 };
    // daysUntilNextSunday = 7-1=6, advance = 6 + (2-1)*7 = 13
    // Sunday = 2025-03-23. First day = Wed (3) = 2025-03-26.
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-26");
  });

  it("interval=3 on [Mon, Fri], ref=Tuesday: skips same-week Fri, returns Mon 3 weeks later", () => {
    // 2025-03-11 is a Tuesday (day 2)
    const rule: RecurrenceRule = { type: "weekly", days: [1, 5], interval: 3 };
    // daysUntilNextSunday = 7-2=5, advance = 5 + (3-1)*7 = 19
    // Sunday = 2025-03-30. First day = Mon (1) = 2025-03-31.
    expect(fmt(nextDue(rule, d("2025-03-11")))).toBe("2025-03-31");
  });

  it("interval=2 on [Tue, Thu], ref=Monday: skips same-week Tue, returns Tue 2 weeks later", () => {
    // 2025-03-10 is a Monday (day 1)
    const rule: RecurrenceRule = { type: "weekly", days: [2, 4], interval: 2 };
    // daysUntilNextSunday = 7-1=6, advance = 6 + (2-1)*7 = 13
    // Sunday = 2025-03-23. First day = Tue (2) = 2025-03-25.
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-25");
  });
});

// =============================================================================
// nextDue — monthly
// =============================================================================

describe("nextDue: monthly", () => {
  it("day=15, after is 10th -> returns 15th of same month", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15 };
    expect(fmt(nextDue(rule, d("2025-03-10")))).toBe("2025-03-15");
  });

  it("day=15, after is 20th -> returns 15th of next month", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15 };
    expect(fmt(nextDue(rule, d("2025-03-20")))).toBe("2025-04-15");
  });

  it("day=15, after IS the 15th -> returns 15th of next month", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15 };
    expect(fmt(nextDue(rule, d("2025-03-15")))).toBe("2025-04-15");
  });

  it("day=31 in February (non-leap year) -> clamps to Feb 28", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 31 };
    // After Jan 31 -> next month is Feb, clamped to 28
    expect(fmt(nextDue(rule, d("2025-01-31")))).toBe("2025-02-28");
  });

  it("day=31 in February (leap year 2024) -> clamps to Feb 29", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 31 };
    expect(fmt(nextDue(rule, d("2024-01-31")))).toBe("2024-02-29");
  });

  it("day=29 in February (non-leap year) -> clamps to Feb 28", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 29 };
    expect(fmt(nextDue(rule, d("2025-01-31")))).toBe("2025-02-28");
  });

  it("day=30 in February (non-leap year) -> clamps to Feb 28", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 30 };
    expect(fmt(nextDue(rule, d("2025-01-31")))).toBe("2025-02-28");
  });

  it("day=31, after is in March -> returns March 31", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 31 };
    expect(fmt(nextDue(rule, d("2025-03-01")))).toBe("2025-03-31");
  });

  it("interval=3 (quarterly): advances 3 months", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 1, interval: 3 };
    // After March 5 -> day 1 is past, advance 3 months -> June 1
    expect(fmt(nextDue(rule, d("2025-03-05")))).toBe("2025-06-01");
  });

  it("interval=3 with month-end clamping across year boundary", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 31, interval: 3 };
    // After Nov 30 -> Nov doesn't have 31, clamped to 30, which is <= 30.
    // Advance 3 months -> February. 31 clamped to 28.
    expect(fmt(nextDue(rule, d("2025-11-30")))).toBe("2026-02-28");
  });

  it("crosses year boundary: December -> next January", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15 };
    expect(fmt(nextDue(rule, d("2025-12-20")))).toBe("2026-01-15");
  });

  it("interval=120 (10 years): modular arithmetic handles large interval correctly", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 1, interval: 120 };
    // After March 5 2025 -> day 1 is past, advance 120 months -> March 2035
    expect(fmt(nextDue(rule, d("2025-03-05")))).toBe("2035-03-01");
  });

  it("interval=12 (yearly via monthly): March + 12 = March next year", () => {
    const rule: RecurrenceRule = { type: "monthly", day: 15, interval: 12 };
    expect(fmt(nextDue(rule, d("2025-03-20")))).toBe("2026-03-15");
  });
});

// =============================================================================
// nextDue — seasonal
// =============================================================================

describe("nextDue: seasonal", () => {
  it("spring (March 15), after is January -> returns March 15 this year", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "spring",
      month: 3,
      day: 15,
    };
    expect(fmt(nextDue(rule, d("2025-01-10")))).toBe("2025-03-15");
  });

  it("spring (March 15), after is April -> returns March 15 next year", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "spring",
      month: 3,
      day: 15,
    };
    expect(fmt(nextDue(rule, d("2025-04-01")))).toBe("2026-03-15");
  });

  it("spring (March 15), after IS March 15 -> returns March 15 this year", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "spring",
      month: 3,
      day: 15,
    };
    expect(fmt(nextDue(rule, d("2025-03-15")))).toBe("2025-03-15");
  });

  it("winter (December 1), after is November -> returns December 1 this year", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "winter",
      month: 12,
      day: 1,
    };
    expect(fmt(nextDue(rule, d("2025-11-15")))).toBe("2025-12-01");
  });

  it("winter (December 1), after is December 5 -> returns December 1 next year", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "winter",
      month: 12,
      day: 1,
    };
    expect(fmt(nextDue(rule, d("2025-12-05")))).toBe("2026-12-01");
  });

  it("seasonal with day clamping (Feb 29 in non-leap year)", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "spring",
      month: 2,
      day: 29,
    };
    // 2025 is not a leap year, so Feb 29 clamps to Feb 28
    expect(fmt(nextDue(rule, d("2025-01-01")))).toBe("2025-02-28");
  });

  it("seasonal with day clamping (Feb 29 in leap year)", () => {
    const rule: RecurrenceRule = {
      type: "seasonal",
      season: "spring",
      month: 2,
      day: 29,
    };
    // 2024 is a leap year
    expect(fmt(nextDue(rule, d("2024-01-01")))).toBe("2024-02-29");
  });
});

// =============================================================================
// nextDue — custom
// =============================================================================

describe("nextDue: custom", () => {
  it("interval_days=45: returns 45 days from after", () => {
    const rule: RecurrenceRule = { type: "custom", interval_days: 45 };
    // 2025-01-01 + 45 days = 2025-02-15
    expect(fmt(nextDue(rule, d("2025-01-01")))).toBe("2025-02-15");
  });

  it("interval_days=90: returns 90 days from after", () => {
    const rule: RecurrenceRule = { type: "custom", interval_days: 90 };
    // 2025-01-01 + 90 days = 2025-04-01
    expect(fmt(nextDue(rule, d("2025-01-01")))).toBe("2025-04-01");
  });

  it("interval_days=1: same as daily interval=1", () => {
    const rule: RecurrenceRule = { type: "custom", interval_days: 1 };
    expect(fmt(nextDue(rule, d("2025-06-15")))).toBe("2025-06-16");
  });

  it("crosses year boundary", () => {
    const rule: RecurrenceRule = { type: "custom", interval_days: 30 };
    // 2025-12-15 + 30 days = 2026-01-14
    expect(fmt(nextDue(rule, d("2025-12-15")))).toBe("2026-01-14");
  });
});

// =============================================================================
// isOverdue
// =============================================================================

describe("isOverdue", () => {
  it("returns true when next due is yesterday", () => {
    expect(isOverdue("2025-03-09", d("2025-03-10"))).toBe(true);
  });

  it("returns false when next due is today", () => {
    expect(isOverdue("2025-03-10", d("2025-03-10"))).toBe(false);
  });

  it("returns false when next due is tomorrow", () => {
    expect(isOverdue("2025-03-11", d("2025-03-10"))).toBe(false);
  });

  it("returns true when next due is 30 days ago", () => {
    expect(isOverdue("2025-02-08", d("2025-03-10"))).toBe(true);
  });

  it("returns false when next due is far in the future", () => {
    expect(isOverdue("2026-01-01", d("2025-03-10"))).toBe(false);
  });
});

// =============================================================================
// daysOverdue
// =============================================================================

describe("daysOverdue", () => {
  it("returns 1 when next due was yesterday", () => {
    expect(daysOverdue("2025-03-09", d("2025-03-10"))).toBe(1);
  });

  it("returns 0 when next due is today", () => {
    expect(daysOverdue("2025-03-10", d("2025-03-10"))).toBe(0);
  });

  it("returns 0 when next due is tomorrow (not overdue)", () => {
    expect(daysOverdue("2025-03-11", d("2025-03-10"))).toBe(0);
  });

  it("returns 30 when next due was 30 days ago", () => {
    expect(daysOverdue("2025-02-08", d("2025-03-10"))).toBe(30);
  });

  it("returns 365 when next due was a year ago", () => {
    expect(daysOverdue("2024-03-10", d("2025-03-10"))).toBe(365);
  });

  it("returns 1 across spring-forward DST transition (23-hour day)", () => {
    // US spring-forward 2026 is March 8. Due March 7, ref March 8.
    expect(daysOverdue("2026-03-07", d("2026-03-08"))).toBe(1);
  });

  it("returns 1 across fall-back DST transition (25-hour day)", () => {
    // US fall-back 2026 is November 1. Due October 31, ref November 1.
    expect(daysOverdue("2026-10-31", d("2026-11-01"))).toBe(1);
  });
});

// =============================================================================
// recurrenceLabel
// =============================================================================

describe("recurrenceLabel", () => {
  it("returns empty string for null", () => {
    expect(recurrenceLabel(null)).toBe("");
  });

  it("returns empty string for invalid JSON", () => {
    expect(recurrenceLabel("not json")).toBe("");
  });

  it("returns label for once rule", () => {
    expect(recurrenceLabel('{"type":"once","date":"2025-06-15"}')).toBe(
      "Once on 2025-06-15"
    );
  });

  it("returns 'Daily' for daily interval=1", () => {
    expect(recurrenceLabel('{"type":"daily","interval":1}')).toBe("Daily");
  });

  it("returns 'Every N days' for daily interval>1", () => {
    expect(recurrenceLabel('{"type":"daily","interval":3}')).toBe(
      "Every 3 days"
    );
  });

  it("returns weekly label with day names", () => {
    expect(recurrenceLabel('{"type":"weekly","days":[1,3,5]}')).toBe(
      "Weekly on Monday, Wednesday, Friday"
    );
  });

  it("returns biweekly label", () => {
    expect(
      recurrenceLabel('{"type":"weekly","days":[1],"interval":2}')
    ).toBe("Every 2 weeks on Monday");
  });

  it("returns monthly label", () => {
    expect(recurrenceLabel('{"type":"monthly","day":15}')).toBe(
      "Monthly on day 15"
    );
  });

  it("returns quarterly label", () => {
    expect(
      recurrenceLabel('{"type":"monthly","day":1,"interval":3}')
    ).toBe("Every 3 months on day 1");
  });

  it("returns seasonal label", () => {
    expect(
      recurrenceLabel(
        '{"type":"seasonal","season":"spring","month":3,"day":15}'
      )
    ).toBe("Spring (3/15)");
  });

  it("returns custom label", () => {
    expect(recurrenceLabel('{"type":"custom","interval_days":45}')).toBe(
      "Every 45 days"
    );
  });
});

// =============================================================================
// isValidDateString
// =============================================================================

describe("isValidDateString", () => {
  it("accepts a valid date", () => {
    expect(isValidDateString("2024-06-15")).toBe(true);
  });

  it("accepts Feb 29 in leap year", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
  });

  it("rejects Feb 30", () => {
    expect(isValidDateString("2024-02-30")).toBe(false);
  });

  it("rejects Feb 29 in non-leap year", () => {
    expect(isValidDateString("2023-02-29")).toBe(false);
  });

  it("rejects month 13", () => {
    expect(isValidDateString("2024-13-01")).toBe(false);
  });

  it("rejects month 0", () => {
    expect(isValidDateString("2024-00-15")).toBe(false);
  });

  it("rejects wrong format", () => {
    expect(isValidDateString("2024/06/15")).toBe(false);
  });

  it("rejects non-date string", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
  });

  it("accepts Jan 31", () => {
    expect(isValidDateString("2024-01-31")).toBe(true);
  });

  it("rejects Apr 31", () => {
    expect(isValidDateString("2024-04-31")).toBe(false);
  });
});
