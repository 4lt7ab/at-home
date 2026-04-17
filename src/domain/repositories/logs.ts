import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { Log } from "../entities";

export interface LogFilter {
  id?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export class LogRepository {
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<Log | null> {
    const [row] = await this.sql<Log[]>`SELECT * FROM logs WHERE id = ${id}`;
    return row ?? null;
  }

  async findByNameExact(name: string): Promise<Log[]> {
    return await this.sql<Log[]>`SELECT * FROM logs WHERE LOWER(name) = LOWER(${name}) ORDER BY created_at ASC`;
  }

  async findByNameLike(name: string): Promise<Log[]> {
    return await this.sql<Log[]>`SELECT * FROM logs WHERE name ILIKE ${"%" + escapeLike(name) + "%"} ORDER BY created_at ASC`;
  }

  async findMany(filter?: LogFilter): Promise<Log[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.name) parts.push(this.sql`name ILIKE ${"%" + escapeLike(filter.name) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<Log[]>`
      SELECT * FROM logs ${where}
      ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: Omit<LogFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.name) parts.push(this.sql`name ILIKE ${"%" + escapeLike(filter.name) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM logs ${where}`;
    return row.total;
  }

  /** Compute last_logged_at and entry_count projections for a batch of log ids. */
  async projectionsForIds(ids: string[]): Promise<Map<string, { last_logged_at: string | null; entry_count: number }>> {
    const result = new Map<string, { last_logged_at: string | null; entry_count: number }>();
    if (ids.length === 0) return result;

    const rows = await this.sql<{ log_id: string; last_logged_at: string | null; entry_count: number }[]>`
      SELECT log_id, MAX(occurred_at) AS last_logged_at, COUNT(*)::int AS entry_count
      FROM log_entries
      WHERE log_id = ANY(${ids})
      GROUP BY log_id
    `;

    for (const id of ids) {
      result.set(id, { last_logged_at: null, entry_count: 0 });
    }
    for (const row of rows) {
      result.set(row.log_id, {
        last_logged_at: row.last_logged_at,
        entry_count: row.entry_count,
      });
    }
    return result;
  }

  async insertMany(rows: { name: string; description?: string | null }[]): Promise<Log[]> {
    const now = new Date().toISOString();
    const results: Log[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<Log[]>`
        INSERT INTO logs (id, name, description, created_at, updated_at)
        VALUES (${id}, ${row.name}, ${row.description ?? null}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(rows: { id: string; name?: string; description?: string | null }[]): Promise<Log[]> {
    const now = new Date().toISOString();
    const results: Log[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const name = row.name !== undefined ? row.name : existing.name;
      const description = row.description !== undefined ? row.description : existing.description;

      const [updated] = await this.sql<Log[]>`
        UPDATE logs SET name = ${name}, description = ${description}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM logs WHERE id = ANY(${ids})`;
    return result.count;
  }
}
