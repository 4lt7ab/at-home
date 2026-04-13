/**
 * Seed the development database with realistic data.
 *
 * Usage:
 *   bun run scripts/seed.ts          # uses DATABASE_URL or dev default
 *   bun run seed                     # via package.json script
 *
 * This script is idempotent — it clears existing data before seeding.
 * Maintain this file whenever new entities or UI features are added.
 *
 * Coverage:
 *   - Notes: various titles and contexts, some with no context
 *   - Reminders: overdue, this week, next week, recurring (all cadences),
 *     one-shot, and dormant
 */

import { bootstrap } from "../src/domain/bootstrap";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Sunday 00:00 UTC of the current week. */
function thisSunday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
}

/** Offset days from a base date, always midnight UTC. */
function offsetDay(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const weekStart = thisSunday();

const notes = [
  { title: "Grocery list", context: "Eggs, milk, bread, butter, onions, garlic, olive oil, chicken thighs, rice, broccoli" },
  { title: "Book recommendations", context: "- The Design of Everyday Things (Don Norman)\n- Thinking in Systems (Donella Meadows)\n- Staff Engineer (Will Larson)\n- A Philosophy of Software Design (John Ousterhout)" },
  { title: "Workout routine", context: "**Monday/Thursday**: Squats 3×8, Bench 3×8, Rows 3×10\n**Tuesday/Friday**: Deadlifts 3×5, OHP 3×8, Pull-ups 3×max\n**Wednesday**: Rest or 30min easy cardio" },
  { title: "Home server TODO" },
  { title: "Gift ideas for Mom", context: "- Ceramic planter from the Saturday market\n- That cookbook she mentioned (Ottolenghi Simple)\n- Spa gift card" },
  { title: "Apartment maintenance log", context: "2026-03-15: Changed HVAC filter\n2026-02-20: Fixed leaking kitchen faucet\n2026-01-10: Smoke detector batteries replaced\n\nNext: Check water heater anode rod (every 2 years, last done 2025-01)" },
  { title: "Meeting notes — Q2 planning", context: "Key decisions:\n1. Ship reminders feature by mid-April\n2. Defer mobile app to Q3\n3. Focus on stability and test coverage first\n\nAction items: Jake owns seed script, Sarah owns deploy pipeline" },
  { title: "Quick thought" },
];

const reminders = {
  overdue: [
    { context: "Pay electricity bill — due April 5th", remind_at: offsetDay(weekStart, -8) },
    { context: "RSVP to Jake's dinner party", remind_at: offsetDay(weekStart, -3) },
  ],

  thisWeek: [
    { context: "Team standup — prepare sprint update", remind_at: offsetDay(weekStart, 1), recurrence: "weekly" as const },
    { context: "Dentist appointment — Dr. Patel", remind_at: offsetDay(weekStart, 2) },
    { context: "Submit expense report for March", remind_at: offsetDay(weekStart, 3) },
    { context: "Water the plants", remind_at: offsetDay(weekStart, 0), recurrence: "weekly" as const },
    { context: "Call Mom", remind_at: offsetDay(weekStart, 6), recurrence: "weekly" as const },
  ],

  nextWeek: [
    { context: "Quarterly tax payment deadline", remind_at: offsetDay(weekStart, 8) },
    { context: "Car oil change — schedule at Jiffy Lube", remind_at: offsetDay(weekStart, 9), recurrence: "monthly" as const },
    { context: "Payroll review and approval", remind_at: offsetDay(weekStart, 11), recurrence: "biweekly" as const },
    { context: "Review and merge open PRs before release", remind_at: offsetDay(weekStart, 10) },
    { context: "Anniversary dinner reservation", remind_at: offsetDay(weekStart, 12), recurrence: "yearly" as const },
  ],

  dormant: [
    { context: "Renew passport — submitted application, waiting for processing", remind_at: offsetDay(weekStart, -30) },
    { context: "Follow up on warranty claim for dishwasher", remind_at: offsetDay(weekStart, -14) },
  ],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log("Bootstrapping…");
  const ctx = await bootstrap();

  // Clear existing data
  console.log("Clearing existing data…");
  const existingNotes = await ctx.noteService.list({ limit: 1000 });
  if (existingNotes.data.length > 0) {
    await ctx.noteService.remove(existingNotes.data.map((n) => n.id));
  }
  const existingReminders = await ctx.reminderService.list({ limit: 1000 });
  if (existingReminders.data.length > 0) {
    await ctx.reminderService.remove(existingReminders.data.map((r) => r.id));
  }

  // Seed notes
  console.log(`Creating ${notes.length} notes…`);
  await ctx.noteService.create(notes);

  // Seed active reminders (overdue + this week + next week)
  const activeReminders = [
    ...reminders.overdue,
    ...reminders.thisWeek,
    ...reminders.nextWeek,
  ];
  console.log(`Creating ${activeReminders.length} active reminders…`);
  await ctx.reminderService.create(activeReminders);

  // Seed dormant reminders — create then dismiss without recurrence
  console.log(`Creating ${reminders.dormant.length} dormant reminders…`);
  const dormantCreated = await ctx.reminderService.create(reminders.dormant);
  for (const r of dormantCreated) {
    await ctx.reminderService.dismiss({ id: r.id });
  }

  // Summary
  const noteCount = (await ctx.noteService.list({ limit: 1 })).total;
  const reminderCount = (await ctx.reminderService.list({ limit: 1 })).total;
  console.log(`\nSeeded: ${noteCount} notes, ${reminderCount} reminders`);
  console.log("  Overdue:    %d", reminders.overdue.length);
  console.log("  This week:  %d", reminders.thisWeek.length);
  console.log("  Next week:  %d", reminders.nextWeek.length);
  console.log("  Dormant:    %d", reminders.dormant.length);

  await ctx.sql.end();
  console.log("\nDone.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
