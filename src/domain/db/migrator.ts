import type { Sql } from "./connection";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getAppliedMigrations(sql: Sql): Promise<Set<string>> {
  const rows = await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`;
  return new Set(rows.map((r) => r.filename));
}

function getPendingMigrations(applied: Set<string>): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => [".sql", ".ts"].includes(extname(f)))
    .sort();
  return files.filter((f) => !applied.has(f));
}

async function applySqlMigration(sql: Sql, filename: string): Promise<void> {
  const content = readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
    await tx`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
  });
}

async function applyTsMigration(sql: Sql, filename: string): Promise<void> {
  const mod = await import(join(MIGRATIONS_DIR, filename));
  if (typeof mod.up !== "function") {
    throw new Error(
      `Migration ${filename} must export an 'up(sql: Sql)' function`
    );
  }
  await sql.begin(async (tx) => {
    await mod.up(tx);
    await tx`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
  });
}

export async function runMigrations(sql: Sql): Promise<void> {
  await ensureMigrationsTable(sql);
  const applied = await getAppliedMigrations(sql);
  const pending = getPendingMigrations(applied);

  if (pending.length === 0) return;

  for (const filename of pending) {
    if (extname(filename) === ".ts") {
      await applyTsMigration(sql, filename);
    } else {
      await applySqlMigration(sql, filename);
    }
    console.log(`[migrate] applied ${filename}`);
  }
}
