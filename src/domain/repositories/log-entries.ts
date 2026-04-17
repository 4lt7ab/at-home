import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { LogEntry } from "../entities";

export interface LogEntryFilter {
  id?: string;
  log_id?: string;
  occurred_at_from?: string;
  occurred_at_to?: string;
  limit?: number;
  offset?: number;
}

export class LogEntryRepository {
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<LogEntry | null> {
    const [row] = await this.sql<LogEntry[]>`SELECT * FROM log_entries WHERE id = ${id}`;
    return row ?? null;
  }

  async findMany(filter?: LogEntryFilter): Promise<LogEntry[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.log_id) parts.push(this.sql`log_id = ${filter.log_id}`);
    if (filter?.occurred_at_from) parts.push(this.sql`occurred_at >= ${filter.occurred_at_from}`);
    if (filter?.occurred_at_to) parts.push(this.sql`occurred_at <= ${filter.occurred_at_to}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<LogEntry[]>`
      SELECT * FROM log_entries ${where}
      ORDER BY occurred_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: Omit<LogEntryFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.log_id) parts.push(this.sql`log_id = ${filter.log_id}`);
    if (filter?.occurred_at_from) parts.push(this.sql`occurred_at >= ${filter.occurred_at_from}`);
    if (filter?.occurred_at_to) parts.push(this.sql`occurred_at <= ${filter.occurred_at_to}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM log_entries ${where}`;
    return row.total;
  }

  async insertMany(
    rows: { log_id: string; occurred_at: string; note?: string | null; metadata?: Record<string, unknown> | null }[],
  ): Promise<LogEntry[]> {
    const now = new Date().toISOString();
    const results: LogEntry[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<LogEntry[]>`
        INSERT INTO log_entries (id, log_id, occurred_at, note, metadata, created_at, updated_at)
        VALUES (
          ${id},
          ${row.log_id},
          ${row.occurred_at},
          ${row.note ?? null},
          ${row.metadata == null ? null : this.sql.json(row.metadata) as any},
          ${now},
          ${now}
        )
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(
    rows: { id: string; occurred_at?: string; note?: string | null; metadata?: Record<string, unknown> | null }[],
  ): Promise<LogEntry[]> {
    const now = new Date().toISOString();
    const results: LogEntry[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const occurred_at = row.occurred_at !== undefined ? row.occurred_at : existing.occurred_at;
      const note = row.note !== undefined ? row.note : existing.note;
      const metadata =
        row.metadata !== undefined
          ? (row.metadata == null ? null : this.sql.json(row.metadata) as any)
          : (existing.metadata == null ? null : this.sql.json(existing.metadata) as any);

      const [updated] = await this.sql<LogEntry[]>`
        UPDATE log_entries
        SET occurred_at = ${occurred_at}, note = ${note}, metadata = ${metadata}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM log_entries WHERE id = ANY(${ids})`;
    return result.count;
  }
}
