/**
 * seed.js — Populate tab-at-home with realistic sample data.
 *
 * Seeds every data scenario the UI can display: all task statuses, areas,
 * effort levels, recurrence types, overdue/today/upcoming schedules, notes
 * (task-linked and standalone), and completion history with activity log entries.
 *
 * Usage:
 *   bun scripts/seed.js                        # default: http://localhost:3100
 *   bun scripts/seed.js --base-url http://host:port
 *   BASE_URL=http://host:port bun scripts/seed.js
 *
 * Prerequisites:
 *   The dev server must be running (`bun run dev`).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let BASE_URL = process.env.BASE_URL || "http://localhost:3100";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base-url" && args[i + 1]) {
    BASE_URL = args[i + 1];
    i++;
  }
}
BASE_URL = BASE_URL.replace(/\/+$/, ""); // strip trailing slash

// ---------------------------------------------------------------------------
// Date helpers — everything relative to "today"
// ---------------------------------------------------------------------------

function today() {
  const d = new Date();
  return formatDate(d);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Return the day-of-week (0=Sun..6=Sat) for a date N days from now. */
function dayOfWeekFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getDay();
}

/** Return the day-of-month for a date N days from now. */
function dayOfMonthFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getDate();
}

/** Return month (1-12) for a date N days from now. */
function monthFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getMonth() + 1;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function createTask(item) {
  const tasks = await api("POST", "/api/tasks", { items: [item] });
  return tasks[0];
}

async function updateTask(item) {
  const tasks = await api("PATCH", "/api/tasks", { items: [item] });
  return tasks[0];
}

async function createSchedule(item) {
  const schedules = await api("POST", "/api/schedules", { items: [item] });
  return schedules[0];
}

async function updateSchedule(item) {
  const schedules = await api("PATCH", "/api/schedules", { items: [item] });
  return schedules[0];
}

async function createNote(item) {
  const notes = await api("POST", "/api/notes", { items: [item] });
  return notes[0];
}

async function completeTask(taskId, note) {
  const body = { task_id: taskId };
  if (note) body.note = note;
  return api("POST", "/api/summary/complete", body);
}

// ---------------------------------------------------------------------------
// Progress logging
// ---------------------------------------------------------------------------

let stepCount = 0;
function log(msg) {
  stepCount++;
  console.log(`  [${stepCount}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

/**
 * Each entry defines a task + optional schedule + optional notes + optional
 * completions. Tasks are grouped by the scenario they exercise.
 */
const SEED_TASKS = [
  // =========================================================================
  // OVERDUE tasks (next_due in the past)
  // =========================================================================
  {
    task: { title: "Clean gutters", description: "Remove leaves and debris from all gutters. Check downspouts for clogs.", area: "exterior", effort: "high" },
    schedule: { recurrence_type: "seasonal", recurrence_rule: JSON.stringify({ type: "seasonal", season: "fall", month: 10, day: 15 }), next_due: daysFromNow(-14) },
    notes: [
      { title: "Last cleaning notes", content: "Found a bird nest in the north-side gutter. Downspout on the east side was partially clogged with pine needles." },
    ],
  },
  {
    task: { title: "Replace HVAC filter", description: "Use 20x25x1 MERV-11 filter. Stock is in the basement utility closet.", area: "hvac", effort: "trivial" },
    schedule: { recurrence_type: "monthly", recurrence_rule: JSON.stringify({ type: "monthly", day: 1 }), next_due: daysFromNow(-5) },
    notes: [
      { title: "Filter specs", content: "Brand: Filtrete, Size: 20x25x1, MERV rating: 11. Costco sells 4-packs." },
      { title: "Replacement history", content: "Replaced on 2/1 — filter was dark gray after only 3 weeks. May need to switch to MERV-13 during spring pollen season." },
    ],
  },
  {
    task: { title: "Mop kitchen floor", area: "kitchen", effort: "medium" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [6] }), next_due: daysFromNow(-3) },
    notes: [],
  },
  {
    task: { title: "Water indoor plants", area: "living_room", effort: "trivial" },
    schedule: { recurrence_type: "daily", recurrence_rule: JSON.stringify({ type: "daily", interval: 3 }), next_due: daysFromNow(-1) },
    notes: [],
  },
  {
    task: { title: "Check sump pump", description: "Pour water in the pit to verify pump engages and drains properly.", area: "basement", effort: "low" },
    schedule: { recurrence_type: "monthly", recurrence_rule: JSON.stringify({ type: "monthly", day: 15 }), next_due: daysFromNow(-10) },
    notes: [],
  },

  // =========================================================================
  // DUE TODAY
  // =========================================================================
  {
    task: { title: "Vacuum living room", area: "living_room", effort: "medium" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(0)] }), next_due: today() },
    notes: [
      { title: "Vacuum bag reminder", content: "Check bag level — if more than 3/4 full, replace before vacuuming." },
    ],
  },
  {
    task: { title: "Wipe kitchen counters", area: "kitchen", effort: "trivial" },
    schedule: { recurrence_type: "daily", recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }), next_due: today() },
    notes: [],
  },
  {
    task: { title: "Take out recycling", description: "Blue bin goes to the curb. Check garage for any cardboard to break down.", area: "garage", effort: "trivial" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(0)], interval: 1 }), next_due: today() },
    notes: [],
  },
  {
    task: { title: "Scoop litter boxes", area: "bathroom", effort: "trivial" },
    schedule: { recurrence_type: "daily", recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }), next_due: today() },
    notes: [],
  },
  {
    task: { title: "Run dishwasher", area: "kitchen", effort: "trivial" },
    schedule: { recurrence_type: "daily", recurrence_rule: JSON.stringify({ type: "daily", interval: 1 }), next_due: today() },
    notes: [],
  },

  // =========================================================================
  // UPCOMING — next few days
  // =========================================================================
  {
    task: { title: "Clean bathroom mirrors", area: "bathroom", effort: "low" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(2)] }), next_due: daysFromNow(2) },
    notes: [],
  },
  {
    task: { title: "Dust bedroom furniture", description: "Nightstands, dresser tops, window sills, and ceiling fan blades.", area: "bedroom", effort: "medium" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(3)], interval: 2 }), next_due: daysFromNow(3) },
    notes: [],
  },
  {
    task: { title: "Organize office desk", area: "office", effort: "low" },
    schedule: { recurrence_type: "custom", recurrence_rule: JSON.stringify({ type: "custom", interval_days: 14 }), next_due: daysFromNow(4) },
    notes: [
      { title: "Desk layout reference", content: "Monitor centered, keyboard tray pulled out, file organizer on the left, pen cup on the right. Cables routed through the grommet." },
    ],
  },
  {
    task: { title: "Mow the lawn", description: "Front and back yards. Edge along sidewalk and driveway.", area: "yard", effort: "high" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(5)] }), next_due: daysFromNow(5) },
    notes: [
      { title: "Mower maintenance", content: "Oil changed 3/15. Blade sharpened 3/1. Next blade sharpening due around May." },
    ],
  },
  {
    task: { title: "Test smoke detectors", description: "Press test button on each detector. Replace batteries if chirping.", area: "general", effort: "low" },
    schedule: { recurrence_type: "monthly", recurrence_rule: JSON.stringify({ type: "monthly", day: dayOfMonthFromNow(6) }), next_due: daysFromNow(6) },
    notes: [],
  },

  // =========================================================================
  // UPCOMING — further out (1-4 weeks)
  // =========================================================================
  {
    task: { title: "Deep clean oven", description: "Run self-clean cycle, then wipe down interior. Clean racks separately with baking soda paste.", area: "kitchen", effort: "high" },
    schedule: { recurrence_type: "custom", recurrence_rule: JSON.stringify({ type: "custom", interval_days: 90 }), next_due: daysFromNow(12) },
    notes: [],
  },
  {
    task: { title: "Wash bed linens", area: "bedroom", effort: "medium" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(8)] }), next_due: daysFromNow(8) },
    notes: [],
  },
  {
    task: { title: "Clean dryer vent", description: "Disconnect vent hose and clean lint buildup. Check exterior vent flap.", area: "basement", effort: "medium" },
    schedule: { recurrence_type: "custom", recurrence_rule: JSON.stringify({ type: "custom", interval_days: 180 }), next_due: daysFromNow(21) },
    notes: [],
  },
  {
    task: { title: "Inspect attic insulation", description: "Check for gaps, moisture damage, or pest activity. Measure depth in several spots.", area: "attic", effort: "medium" },
    schedule: { recurrence_type: "seasonal", recurrence_rule: JSON.stringify({ type: "seasonal", season: "spring", month: monthFromNow(25), day: dayOfMonthFromNow(25) }), next_due: daysFromNow(25) },
    notes: [],
  },
  {
    task: { title: "Flush water heater", description: "Attach hose to drain valve. Run until water is clear. Check anode rod condition.", area: "plumbing", effort: "medium" },
    schedule: { recurrence_type: "custom", recurrence_rule: JSON.stringify({ type: "custom", interval_days: 365 }), next_due: daysFromNow(30) },
    notes: [
      { title: "Anode rod status", content: "Inspected 2025-10-01. Rod is about 50% depleted — should last another year. Replacement rod: Camco 11563 (3/4\" thread)." },
    ],
  },

  // =========================================================================
  // ONE-OFF scheduled task (once type, due in future)
  // =========================================================================
  {
    task: { title: "Schedule annual termite inspection", description: "Call Orkin to schedule. Policy number: HT-2025-4412.", area: "exterior", effort: "low" },
    schedule: { recurrence_type: "once", recurrence_rule: JSON.stringify({ type: "once", date: daysFromNow(10) }), next_due: daysFromNow(10) },
    notes: [],
  },

  // =========================================================================
  // ONE-OFF scheduled task (once type, overdue)
  // =========================================================================
  {
    task: { title: "Patch drywall hole in hallway", description: "Small hole near the thermostat from old mounting bracket. Patch kit is in the garage.", area: "general", effort: "low" },
    schedule: { recurrence_type: "once", recurrence_rule: JSON.stringify({ type: "once", date: daysFromNow(-7) }), next_due: daysFromNow(-7) },
    notes: [],
  },

  // =========================================================================
  // PAUSED tasks (will be set to paused after creation)
  // =========================================================================
  {
    task: { title: "Power wash driveway", description: "Rent power washer from Home Depot. Pre-treat oil stains with degreaser.", area: "exterior", effort: "high", _setPaused: true },
    schedule: { recurrence_type: "seasonal", recurrence_rule: JSON.stringify({ type: "seasonal", season: "spring", month: 4, day: 15 }), next_due: daysFromNow(15) },
    notes: [
      { title: "Paused reason", content: "Power washer rental unavailable until mid-April. Will resume then." },
    ],
  },
  {
    task: { title: "Refinish deck", description: "Sand, stain, and seal the back deck. Need 2 consecutive dry days.", area: "yard", effort: "high", _setPaused: true },
    schedule: { recurrence_type: "seasonal", recurrence_rule: JSON.stringify({ type: "seasonal", season: "summer", month: 6, day: 1 }), next_due: daysFromNow(60) },
    notes: [],
  },

  // =========================================================================
  // DONE tasks (one-off tasks that have been completed, no schedule or once-exhausted)
  // =========================================================================
  {
    task: { title: "Install new kitchen faucet", description: "Moen Align model #7565SRS. Tools needed: basin wrench, plumber's tape, adjustable wrench.", area: "plumbing", effort: "high", _setDone: true },
    notes: [
      { title: "Installation complete", content: "Installed successfully on 3/20. Had to replace supply lines — old ones were corroded. Total time: 2.5 hours." },
    ],
  },
  {
    task: { title: "Fix squeaky door hinge — master bedroom", area: "bedroom", effort: "trivial", _setDone: true },
    notes: [],
  },

  // =========================================================================
  // ARCHIVED tasks
  // =========================================================================
  {
    task: { title: "Replace garage door opener", description: "Old Chamberlain model died. Replaced with LiftMaster 87504.", area: "garage", effort: "high", _setArchived: true },
    notes: [
      { title: "Warranty info", content: "LiftMaster 87504, purchased 2025-01-15. Warranty: 5 years motor, 1 year parts. Receipt in Google Drive > Home > Receipts." },
    ],
  },
  {
    task: { title: "Caulk master bathroom tub", area: "bathroom", effort: "medium", _setArchived: true },
    notes: [],
  },

  // =========================================================================
  // Tasks WITHOUT schedule (no recurrence, just standalone tasks)
  // =========================================================================
  {
    task: { title: "Research smart thermostat options", description: "Compare Ecobee, Nest, and Honeywell. Need C-wire compatibility.", area: "hvac", effort: "low" },
    notes: [
      { title: "Research notes", content: "Ecobee Premium ($250) — has C-wire adapter included. Nest Learning ($280) — needs C-wire. Honeywell T9 ($200) — works without C-wire via battery backup." },
    ],
  },
  {
    task: { title: "Organize basement storage", description: "Sort boxes, label containers, set up shelving unit from Costco.", area: "basement", effort: "high" },
    notes: [],
  },
  {
    task: { title: "Fix running toilet in guest bathroom", area: "plumbing", effort: "low" },
    notes: [
      { title: "Diagnosis", content: "Flapper valve is worn — water slowly leaks into bowl causing phantom flushes. Korky 2021BP replacement flapper should fit." },
    ],
  },

  // =========================================================================
  // Tasks with MULTIPLE completions (rich completion history)
  // These get completed several times to generate activity log entries.
  // =========================================================================
  {
    task: { title: "Take out trash", area: "kitchen", effort: "trivial" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [1, 4] }), next_due: daysFromNow(-2) },
    _completions: [
      { note: "Both kitchen and bathroom trash bags replaced." },
      { note: "Light week — only kitchen bag needed replacing." },
      { note: null },
    ],
  },
  {
    task: { title: "Wipe down kitchen appliances", description: "Microwave interior/exterior, toaster, coffee maker, dishwasher front panel.", area: "kitchen", effort: "low" },
    schedule: { recurrence_type: "weekly", recurrence_rule: JSON.stringify({ type: "weekly", days: [dayOfWeekFromNow(1)] }), next_due: daysFromNow(1) },
    _completions: [
      { note: "Used stainless steel cleaner on fridge and dishwasher." },
      { note: "Microwave needed extra attention — soup splatter." },
    ],
  },

  // =========================================================================
  // Task with NO notes, NO schedule, NO description — minimal data
  // =========================================================================
  {
    task: { title: "Buy replacement light bulbs", area: "electrical", effort: "trivial" },
    notes: [],
  },

  // =========================================================================
  // Task with electrical area and a daily schedule (covers electrical area)
  // =========================================================================
  {
    task: { title: "Reset outdoor timer for landscape lights", area: "electrical", effort: "trivial" },
    schedule: { recurrence_type: "seasonal", recurrence_rule: JSON.stringify({ type: "seasonal", season: "winter", month: 11, day: 1 }), next_due: daysFromNow(45) },
    notes: [],
  },
];

/**
 * Standalone notes — not linked to any task.
 */
const STANDALONE_NOTES = [
  {
    title: "WiFi network info",
    content: "SSID: HomeNet-5G\nPassword: (see password manager)\nRouter: TP-Link Archer AX73, admin at 192.168.1.1\nISP: Comcast, account #: 8374-2910-4455",
  },
  {
    title: "Paint colors reference",
    content: "Living room: Benjamin Moore \"Simply White\" OC-117\nKitchen: Sherwin-Williams \"Agreeable Gray\" SW-7029\nMaster bedroom: Farrow & Ball \"Hague Blue\" No.30\nExterior trim: Benjamin Moore \"Wrought Iron\" 2124-10",
  },
  {
    title: "Emergency contacts",
    content: "Plumber: Mike's Plumbing, (555) 234-5678\nElectrician: Spark Electric, (555) 345-6789\nHVAC: Comfort Air Services, (555) 456-7890\nLocksmith: KeyMaster, (555) 567-8901",
  },
  {
    title: "Spring cleaning checklist",
    content: "- [ ] Windows (inside and out)\n- [ ] Ceiling fans\n- [ ] Behind/under large appliances\n- [ ] Baseboards\n- [ ] Light fixtures and lampshades\n- [ ] Closet purge and reorganize\n- [ ] Garage deep clean",
  },
  {
    title: "Appliance model numbers",
    content: "Fridge: Samsung RF28R7551SR\nDishwasher: Bosch SHPM88Z75N\nWasher: LG WM4000HWA\nDryer: LG DLEX4000W\nOven: GE Profile PGS930YPFS",
  },
];

// ---------------------------------------------------------------------------
// Main seed logic
// ---------------------------------------------------------------------------

async function seed() {
  console.log(`\nSeeding tab-at-home at ${BASE_URL}...\n`);

  // Verify the server is reachable
  try {
    const health = await api("GET", "/api/health");
    if (health.status !== "ok" && health.status !== "degraded") {
      throw new Error("unexpected health status");
    }
    log(`Server is reachable (status: ${health.status})`);
  } catch (err) {
    console.error(`\nFailed to reach server at ${BASE_URL}/api/health`);
    console.error("Is the dev server running? (bun run dev)\n");
    process.exit(1);
  }

  // Track created task IDs for summary
  const createdTasks = [];

  // -----------------------------------------------------------------------
  // Create tasks, schedules, and notes
  // -----------------------------------------------------------------------
  for (const entry of SEED_TASKS) {
    const task = await createTask(entry.task);
    createdTasks.push(task);
    log(`Task: "${task.title}" (${task.area || "no area"}, ${task.effort || "no effort"})`);

    // Create schedule if defined
    if (entry.schedule) {
      const sched = await createSchedule({
        task_id: task.id,
        ...entry.schedule,
      });
      log(`  Schedule: ${sched.recurrence_type}, next_due=${sched.next_due}`);
    }

    // Create notes if defined
    if (entry.notes && entry.notes.length > 0) {
      for (const noteData of entry.notes) {
        await createNote({ ...noteData, task_id: task.id });
      }
      log(`  Notes: ${entry.notes.length} created`);
    }

    // Handle completions — complete the task multiple times
    if (entry._completions) {
      for (const comp of entry._completions) {
        const result = await completeTask(task.id, comp.note);
        log(`  Completed: next_due=${result.next_due || "exhausted"}`);
      }
    }

    // Set status to paused (must be done AFTER schedule creation, since
    // paused tasks can't be completed)
    if (entry.task._setPaused) {
      await updateTask({ id: task.id, status: "paused" });
      log("  Status -> paused");
    }

    // Set status to done
    if (entry.task._setDone) {
      await updateTask({ id: task.id, status: "done" });
      log("  Status -> done");
    }

    // Set status to archived
    if (entry.task._setArchived) {
      await updateTask({ id: task.id, status: "archived" });
      log("  Status -> archived");
    }
  }

  // -----------------------------------------------------------------------
  // Create standalone notes
  // -----------------------------------------------------------------------
  console.log("");
  for (const noteData of STANDALONE_NOTES) {
    await createNote(noteData);
    log(`Standalone note: "${noteData.title}"`);
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log("");
  const summary = await api("GET", "/api/summary");
  console.log("--- Daily Summary ---");
  console.log(`  Overdue:  ${summary.counts.overdue}`);
  console.log(`  Today:    ${summary.counts.due_today}`);
  console.log(`  Upcoming: ${summary.counts.upcoming}`);
  console.log(`  Total:    ${summary.counts.total}`);

  const taskList = await api("GET", "/api/tasks?limit=200");
  const activityLog = await api("GET", "/api/activity-log?limit=1");
  console.log(`\n  Tasks in database: ${taskList.total}`);
  console.log(`  Activity log entries: ${activityLog.total}`);

  console.log(`\nDone! Seeded ${createdTasks.length} tasks, ${STANDALONE_NOTES.length} standalone notes.\n`);
}

seed().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  process.exit(1);
});
