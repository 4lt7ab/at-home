import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

function ensureMigrationsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
}

function getAppliedMigrations(db: Database): Set<string> {
  const rows = db
    .query("SELECT filename FROM schema_migrations")
    .all() as { filename: string }[];
  return new Set(rows.map((r) => r.filename));
}

function getPendingMigrations(applied: Set<string>): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => [".sql", ".ts"].includes(extname(f)))
    .sort();
  return files.filter((f) => !applied.has(f));
}

function applySqlMigration(db: Database, filename: string): void {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
  db.transaction(() => {
    db.exec(sql);
    db.run("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
  })();
}

async function applyTsMigration(
  db: Database,
  filename: string
): Promise<void> {
  const mod = await import(join(MIGRATIONS_DIR, filename));
  if (typeof mod.up !== "function") {
    throw new Error(
      `Migration ${filename} must export an 'up(db: Database)' function`
    );
  }
  db.transaction(() => {
    mod.up(db);
    db.run("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
  })();
}

export async function runMigrations(db: Database): Promise<void> {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrations(db);
  const pending = getPendingMigrations(applied);

  if (pending.length > 0) {
    const dbPath = db.filename;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(
      dirname(dbPath),
      `${basename(dbPath)}.backup-${timestamp}`
    );
    copyFileSync(dbPath, backupPath);
    console.log(`[migrate] backed up database to ${backupPath}`);

    db.run("PRAGMA foreign_keys = OFF");
    console.log("[migrate] disabled foreign keys for migration safety");
  }

  for (const filename of pending) {
    if (extname(filename) === ".ts") {
      await applyTsMigration(db, filename);
    } else {
      applySqlMigration(db, filename);
    }
    console.log(`[migrate] applied ${filename}`);
  }

  if (pending.length > 0) {
    db.run("PRAGMA foreign_keys = ON");
    console.log("[migrate] re-enabled foreign keys");
  }
}
