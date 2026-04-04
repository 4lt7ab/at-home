import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import type { Schedule } from "../entities";

export class ScheduleRepository {
  constructor(private db: Database) {}

  findById(id: string): Schedule | null {
    return this.db.query("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule | null;
  }

  findMany(filter?: {
    id?: string;
    task_id?: string;
    recurrence_type?: string;
    limit?: number;
    offset?: number;
  }): Schedule[] {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.task_id) {
      conditions.push("task_id = ?");
      params.push(filter.task_id);
    }
    if (filter?.recurrence_type) {
      conditions.push("recurrence_type = ?");
      params.push(filter.recurrence_type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";
    params.push(limit, offset);

    return this.db
      .query(
        `SELECT * FROM schedules ${where}ORDER BY CASE WHEN next_due IS NULL THEN 1 ELSE 0 END, next_due ASC LIMIT ? OFFSET ?`
      )
      .all(...params) as Schedule[];
  }

  count(filter?: {
    id?: string;
    task_id?: string;
    recurrence_type?: string;
  }): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.task_id) {
      conditions.push("task_id = ?");
      params.push(filter.task_id);
    }
    if (filter?.recurrence_type) {
      conditions.push("recurrence_type = ?");
      params.push(filter.recurrence_type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";

    return (
      this.db
        .query(`SELECT COUNT(*) as total FROM schedules ${where}`)
        .get(...params) as { total: number }
    ).total;
  }

  insertMany(
    rows: {
      task_id: string;
      recurrence_type: string;
      recurrence_rule: string | null;
      next_due: string | null;
      last_completed: string | null;
    }[]
  ): Schedule[] {
    const stmt = this.db.query(
      "INSERT INTO schedules (id, task_id, recurrence_type, recurrence_rule, next_due, last_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const now = new Date().toISOString();
    const ids: string[] = [];

    for (const row of rows) {
      const id = ulid();
      ids.push(id);
      stmt.run(
        id,
        row.task_id,
        row.recurrence_type,
        row.recurrence_rule ?? null,
        row.next_due ?? null,
        row.last_completed ?? null,
        now,
        now
      );
    }

    return ids.map((id) => this.findById(id)!);
  }

  updateMany(
    rows: {
      id: string;
      recurrence_type?: string;
      recurrence_rule?: string | null;
      next_due?: string | null;
      last_completed?: string | null;
    }[]
  ): Schedule[] {
    const now = new Date().toISOString();
    const results: Schedule[] = [];

    for (const row of rows) {
      const existing = this.findById(row.id);
      if (!existing) continue;

      const recurrence_type =
        row.recurrence_type !== undefined ? row.recurrence_type : existing.recurrence_type;
      const recurrence_rule =
        row.recurrence_rule !== undefined ? row.recurrence_rule : existing.recurrence_rule;
      const next_due = row.next_due !== undefined ? row.next_due : existing.next_due;
      const last_completed =
        row.last_completed !== undefined ? row.last_completed : existing.last_completed;

      this.db
        .query(
          "UPDATE schedules SET recurrence_type = ?, recurrence_rule = ?, next_due = ?, last_completed = ?, updated_at = ? WHERE id = ?"
        )
        .run(recurrence_type, recurrence_rule, next_due, last_completed, now, row.id);

      results.push(this.findById(row.id)!);
    }

    return results;
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    this.db.query(`DELETE FROM schedules WHERE id IN (${placeholders})`).run(...ids);
    return (this.db.query("SELECT changes() as c").get() as { c: number }).c;
  }

  /** Returns all schedules with next_due on or before asOfDate. */
  findDueOrOverdue(asOfDate: string): Schedule[] {
    return this.db
      .query(
        "SELECT * FROM schedules WHERE next_due IS NOT NULL AND next_due <= ? ORDER BY next_due ASC"
      )
      .all(asOfDate) as Schedule[];
  }

  /** Returns schedules with next_due strictly after afterDate and on or before beforeDate. */
  findUpcoming(afterDate: string, beforeDate: string): Schedule[] {
    return this.db
      .query(
        "SELECT * FROM schedules WHERE next_due > ? AND next_due <= ? ORDER BY next_due ASC"
      )
      .all(afterDate, beforeDate) as Schedule[];
  }

  /** Returns the schedule for a given task, or null if none exists. */
  findByTaskId(taskId: string): Schedule | null {
    return this.db
      .query("SELECT * FROM schedules WHERE task_id = ? LIMIT 1")
      .get(taskId) as Schedule | null;
  }
}
