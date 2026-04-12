import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { Schedule } from "../entities";

export class ScheduleRepository {
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<Schedule | null> {
    const [row] = await this.sql<Schedule[]>`SELECT * FROM schedules WHERE id = ${id}`;
    return row ?? null;
  }

  async findMany(filter?: {
    id?: string;
    task_id?: string;
    recurrence_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Schedule[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.task_id) parts.push(this.sql`task_id = ${filter.task_id}`);
    if (filter?.recurrence_type) parts.push(this.sql`recurrence_type = ${filter.recurrence_type}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<Schedule[]>`
      SELECT * FROM schedules ${where}
      ORDER BY CASE WHEN next_due IS NULL THEN 1 ELSE 0 END, next_due ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: {
    id?: string;
    task_id?: string;
    recurrence_type?: string;
  }): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.task_id) parts.push(this.sql`task_id = ${filter.task_id}`);
    if (filter?.recurrence_type) parts.push(this.sql`recurrence_type = ${filter.recurrence_type}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM schedules ${where}`;
    return row.total;
  }

  async insertMany(
    rows: {
      task_id: string;
      recurrence_type: string;
      recurrence_rule: string | null;
      next_due: string | null;
      last_completed: string | null;
    }[]
  ): Promise<Schedule[]> {
    const now = new Date().toISOString();
    const results: Schedule[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<Schedule[]>`
        INSERT INTO schedules (id, task_id, recurrence_type, recurrence_rule, next_due, last_completed, created_at, updated_at)
        VALUES (${id}, ${row.task_id}, ${row.recurrence_type}, ${row.recurrence_rule}, ${row.next_due}, ${row.last_completed}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(
    rows: {
      id: string;
      recurrence_type?: string;
      recurrence_rule?: string | null;
      next_due?: string | null;
      last_completed?: string | null;
    }[]
  ): Promise<Schedule[]> {
    const now = new Date().toISOString();
    const results: Schedule[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const recurrence_type = row.recurrence_type !== undefined ? row.recurrence_type : existing.recurrence_type;
      const recurrence_rule = row.recurrence_rule !== undefined ? row.recurrence_rule : existing.recurrence_rule;
      const next_due = row.next_due !== undefined ? row.next_due : existing.next_due;
      const last_completed = row.last_completed !== undefined ? row.last_completed : existing.last_completed;

      const [updated] = await this.sql<Schedule[]>`
        UPDATE schedules SET recurrence_type = ${recurrence_type}, recurrence_rule = ${recurrence_rule},
          next_due = ${next_due}, last_completed = ${last_completed}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM schedules WHERE id = ANY(${ids})`;
    return result.count;
  }

  async findDueOrOverdue(asOfDate: string): Promise<Schedule[]> {
    return await this.sql<Schedule[]>`
      SELECT * FROM schedules WHERE next_due IS NOT NULL AND next_due <= ${asOfDate}
      ORDER BY next_due ASC
    `;
  }

  async findUpcoming(afterDate: string, beforeDate: string): Promise<Schedule[]> {
    return await this.sql<Schedule[]>`
      SELECT * FROM schedules WHERE next_due > ${afterDate} AND next_due <= ${beforeDate}
      ORDER BY next_due ASC
    `;
  }

  async findByTaskId(taskId: string): Promise<Schedule | null> {
    const [row] = await this.sql<Schedule[]>`SELECT * FROM schedules WHERE task_id = ${taskId} LIMIT 1`;
    return row ?? null;
  }
}
