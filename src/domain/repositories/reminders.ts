import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { Reminder, Recurrence } from "../entities";

export interface ReminderFilter {
  id?: string;
  context?: string;
  remind_at_from?: string;
  remind_at_to?: string;
  status?: 'active' | 'dormant';
  limit?: number;
  offset?: number;
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export class ReminderRepository {
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<Reminder | null> {
    const [row] = await this.sql<Reminder[]>`SELECT * FROM reminders WHERE id = ${id}`;
    return row ?? null;
  }

  async findMany(filter?: ReminderFilter): Promise<Reminder[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.context) parts.push(this.sql`context ILIKE ${"%" + escapeLike(filter.context) + "%"}`);
    if (filter?.remind_at_from) parts.push(this.sql`remind_at >= ${filter.remind_at_from}`);
    if (filter?.remind_at_to) parts.push(this.sql`remind_at <= ${filter.remind_at_to}`);
    if (filter?.status === 'active') parts.push(this.sql`(dismissed_at IS NULL OR dismissed_at < remind_at)`);
    if (filter?.status === 'dormant') parts.push(this.sql`(dismissed_at IS NOT NULL AND dismissed_at >= remind_at)`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<Reminder[]>`
      SELECT * FROM reminders ${where}
      ORDER BY remind_at ASC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: Omit<ReminderFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.context) parts.push(this.sql`context ILIKE ${"%" + escapeLike(filter.context) + "%"}`);
    if (filter?.remind_at_from) parts.push(this.sql`remind_at >= ${filter.remind_at_from}`);
    if (filter?.remind_at_to) parts.push(this.sql`remind_at <= ${filter.remind_at_to}`);
    if (filter?.status === 'active') parts.push(this.sql`(dismissed_at IS NULL OR dismissed_at < remind_at)`);
    if (filter?.status === 'dormant') parts.push(this.sql`(dismissed_at IS NOT NULL AND dismissed_at >= remind_at)`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM reminders ${where}`;
    return row.total;
  }

  async insertMany(rows: { context: string; remind_at: string; recurrence?: Recurrence | null }[]): Promise<Reminder[]> {
    const now = new Date().toISOString();
    const results: Reminder[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<Reminder[]>`
        INSERT INTO reminders (id, context, remind_at, recurrence, dismissed_at, created_at, updated_at)
        VALUES (${id}, ${row.context}, ${row.remind_at}, ${row.recurrence ?? null}, ${null}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(rows: { id: string; context?: string; remind_at?: string; recurrence?: Recurrence | null; dismissed_at?: string | null }[]): Promise<Reminder[]> {
    const now = new Date().toISOString();
    const results: Reminder[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const context = row.context !== undefined ? row.context : existing.context;
      const remind_at = row.remind_at !== undefined ? row.remind_at : existing.remind_at;
      const recurrence = row.recurrence !== undefined ? row.recurrence : existing.recurrence;
      const dismissed_at = row.dismissed_at !== undefined ? row.dismissed_at : existing.dismissed_at;

      const [updated] = await this.sql<Reminder[]>`
        UPDATE reminders SET context = ${context}, remind_at = ${remind_at}, recurrence = ${recurrence}, dismissed_at = ${dismissed_at}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM reminders WHERE id = ANY(${ids})`;
    return result.count;
  }
}
