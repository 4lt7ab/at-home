/**
 * seed.js -- Populate at-home with sample notes.
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
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function createNote(item) {
  const notes = await api("POST", "/api/notes", { items: [item] });
  return notes[0];
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
// Seed data
// ---------------------------------------------------------------------------

const NOTES = [
  {
    title: "WiFi network info",
    context:
      "SSID: HomeNet-5G\nPassword: (see password manager)\nRouter: TP-Link Archer AX73, admin at 192.168.1.1\nISP: Comcast, account #: 8374-2910-4455",
  },
  {
    title: "Paint colors reference",
    context:
      'Living room: Benjamin Moore "Simply White" OC-117\nKitchen: Sherwin-Williams "Agreeable Gray" SW-7029\nMaster bedroom: Farrow & Ball "Hague Blue" No.30\nExterior trim: Benjamin Moore "Wrought Iron" 2124-10',
  },
  {
    title: "Emergency contacts",
    context:
      "Plumber: Mike's Plumbing, (555) 234-5678\nElectrician: Spark Electric, (555) 345-6789\nHVAC: Comfort Air Services, (555) 456-7890\nLocksmith: KeyMaster, (555) 567-8901",
  },
  {
    title: "Grocery list",
    context:
      "- Milk\n- Eggs\n- Bread\n- Coffee beans\n- Olive oil\n- Chicken thighs\n- Spinach\n- Lemons",
  },
  {
    title: "Appliance model numbers",
    context:
      "Fridge: Samsung RF28R7551SR\nDishwasher: Bosch SHPM88Z75N\nWasher: LG WM4000HWA\nDryer: LG DLEX4000W\nOven: GE Profile PGS930YPFS",
  },
  {
    title: "Book recommendations",
    context:
      "- Designing Data-Intensive Applications (Kleppmann)\n- A Philosophy of Software Design (Ousterhout)\n- The Art of Doing Science and Engineering (Hamming)",
  },
  {
    title: "Garden planting schedule",
    context:
      "March: Start tomato and pepper seeds indoors\nApril: Direct sow lettuce, radishes, peas\nMay: Transplant tomatoes and peppers after last frost\nJune: Plant basil, cucumbers, squash",
  },
  {
    title: "Meeting notes - April 10",
    context:
      "Discussed Q2 roadmap priorities. Agreed to focus on performance improvements first, then new features in May. Follow up with design team on the dashboard redesign.",
  },
];

// ---------------------------------------------------------------------------
// Main seed logic
// ---------------------------------------------------------------------------

async function seed() {
  console.log(`\nSeeding at-home at ${BASE_URL}...\n`);

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

  // Create notes
  for (const noteData of NOTES) {
    await createNote(noteData);
    log(`Note: "${noteData.title}"`);
  }

  // Summary
  const noteList = await api("GET", "/api/notes?limit=200");
  console.log(`\n  Notes in database: ${noteList.total}`);
  console.log(`\nDone! Seeded ${NOTES.length} notes.\n`);
}

seed().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  process.exit(1);
});
