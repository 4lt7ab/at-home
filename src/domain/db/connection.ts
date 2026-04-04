import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function getDbPath(): string {
  const path = process.env.SQLITE_PATH;
  if (!path) {
    throw new Error("SQLITE_PATH environment variable is required");
  }
  return path;
}

export function createDatabase(dbPath?: string): Database {
  const resolvedPath = dbPath ?? getDbPath();
  mkdirSync(join(resolvedPath, ".."), { recursive: true });

  const db = new Database(resolvedPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA journal_size_limit = 67108864");

  return db;
}
