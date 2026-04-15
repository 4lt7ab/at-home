import { describe, it, expect } from "vitest";
import { formatRemindAt, dateToDayUtcIso, utcIsoToLocalDate, getTodayBounds, getWeekBounds } from "./utils";

// ---------------------------------------------------------------------------
// formatRemindAt
// ---------------------------------------------------------------------------

describe("formatRemindAt", () => {
  it("displays the correct UTC date regardless of local timezone", () => {
    // April 15 midnight UTC — in UTC-5 this is April 14 at 7pm local.
    // The function must show April 15, not April 14.
    const result = formatRemindAt("2026-04-15T00:00:00.000Z");
    expect(result).toContain("15");
    expect(result).toContain("Apr");
  });

  it("handles end-of-month dates correctly", () => {
    const result = formatRemindAt("2026-01-31T00:00:00.000Z");
    expect(result).toContain("31");
    expect(result).toContain("Jan");
  });

  it("handles Jan 1 midnight UTC (Dec 31 in western timezones)", () => {
    // This is the most dangerous case: Jan 1 UTC = Dec 31 local in US timezones.
    const result = formatRemindAt("2026-01-01T00:00:00.000Z");
    expect(result).toContain("Jan");
    expect(result).toContain("1");
    // Must NOT contain "Dec" or "31"
    expect(result).not.toContain("Dec");
    expect(result).not.toContain("31");
  });
});

// ---------------------------------------------------------------------------
// dateToDayUtcIso
// ---------------------------------------------------------------------------

describe("dateToDayUtcIso", () => {
  it("converts a local Date to midnight UTC ISO string preserving the local calendar date", () => {
    // User picks April 15 in the DatePicker → local Date for April 15
    const localDate = new Date(2026, 3, 15); // month is 0-indexed
    const result = dateToDayUtcIso(localDate);
    expect(result).toBe("2026-04-15T00:00:00.000Z");
  });

  it("handles single-digit months and days with zero-padding", () => {
    const localDate = new Date(2026, 0, 5); // Jan 5
    const result = dateToDayUtcIso(localDate);
    expect(result).toBe("2026-01-05T00:00:00.000Z");
  });

  it("handles Dec 31 correctly", () => {
    const localDate = new Date(2026, 11, 31); // Dec 31
    const result = dateToDayUtcIso(localDate);
    expect(result).toBe("2026-12-31T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// utcIsoToLocalDate
// ---------------------------------------------------------------------------

describe("utcIsoToLocalDate", () => {
  it("returns a local Date whose year/month/day matches the UTC date", () => {
    // April 15 midnight UTC — in any timezone, the returned local Date
    // must have getFullYear()=2026, getMonth()=3, getDate()=15.
    const result = utcIsoToLocalDate("2026-04-15T00:00:00.000Z");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // 0-indexed
    expect(result.getDate()).toBe(15);
  });

  it("handles Jan 1 UTC without shifting to Dec 31", () => {
    const result = utcIsoToLocalDate("2026-01-01T00:00:00.000Z");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("round-trips correctly with dateToDayUtcIso", () => {
    const original = "2026-07-04T00:00:00.000Z";
    const localDate = utcIsoToLocalDate(original);
    const roundTripped = dateToDayUtcIso(localDate);
    expect(roundTripped).toBe(original);
  });

  it("round-trips Dec 31 / Jan 1 boundary", () => {
    const original = "2027-01-01T00:00:00.000Z";
    const localDate = utcIsoToLocalDate(original);
    const roundTripped = dateToDayUtcIso(localDate);
    expect(roundTripped).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// getTodayBounds
// ---------------------------------------------------------------------------

describe("getTodayBounds", () => {
  it("uses local date, consistent with dateToDayUtcIso", () => {
    const now = new Date();
    const { start, end } = getTodayBounds();

    // start should equal dateToDayUtcIso(today-as-local-date)
    const expectedStart = dateToDayUtcIso(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    );
    expect(start).toBe(expectedStart);

    // end should be 1ms before start of tomorrow
    const expectedEnd = dateToDayUtcIso(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    );
    expect(new Date(end).getTime()).toBe(new Date(expectedEnd).getTime() - 1);
  });

  it("a reminder created for today via dateToDayUtcIso falls within today bounds", () => {
    // This is the core invariant: pick "today" in the DatePicker → the stored
    // value must land inside getTodayBounds(), not in overdue.
    const todayLocal = new Date();
    const todayPicked = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
    const remindAt = dateToDayUtcIso(todayPicked);

    const { start, end } = getTodayBounds();
    expect(remindAt >= start).toBe(true);
    expect(remindAt <= end).toBe(true);
  });

  it("a reminder for today is NOT before today.start (not overdue)", () => {
    const todayLocal = new Date();
    const todayPicked = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
    const remindAt = dateToDayUtcIso(todayPicked);

    const { start } = getTodayBounds();
    // Overdue uses remind_at < start (strict). remindAt should equal start, not be less.
    const overdueEnd = new Date(new Date(start).getTime() - 1).toISOString();
    expect(remindAt > overdueEnd).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getWeekBounds
// ---------------------------------------------------------------------------

describe("getWeekBounds", () => {
  it("current week contains today", () => {
    const now = new Date();
    const todayIso = dateToDayUtcIso(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    );

    const { start, end } = getWeekBounds(0);
    expect(todayIso >= start).toBe(true);
    expect(todayIso <= end).toBe(true);
  });

  it("current week start is a Sunday", () => {
    const { start } = getWeekBounds(0);
    const d = utcIsoToLocalDate(start);
    expect(d.getDay()).toBe(0); // Sunday
  });

  it("next week starts 7 days after this week", () => {
    const thisWeek = getWeekBounds(0);
    const nextWeek = getWeekBounds(1);

    const thisStart = new Date(thisWeek.start).getTime();
    const nextStart = new Date(nextWeek.start).getTime();
    expect(nextStart - thisStart).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
