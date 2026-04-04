import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import type { HomeTask } from "../entities";

export interface HomeTaskFilter {
  id?: string;
  status?: string;
  area?: string;
  effort?: string;
  title?: string;
  limit?: number;
  offset?: number;
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export class HomeTaskRepository {
  constructor(private db: Database) {}

  findById(id: string): HomeTask | null {
    return this.db.query("SELECT * FROM home_tasks WHERE id = ?").get(id) as HomeTask | null;
  }

  findMany(filter?: HomeTaskFilter): HomeTask[] {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.status) {
      const statuses = filter.status.split(",");
      if (statuses.length === 1) {
        conditions.push("status = ?");
        params.push(statuses[0]);
      } else {
        conditions.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }
    }
    if (filter?.area) {
      conditions.push("area = ?");
      params.push(filter.area);
    }
    if (filter?.effort) {
      conditions.push("effort = ?");
      params.push(filter.effort);
    }
    if (filter?.title) {
      conditions.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filter.title)}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";
    params.push(limit, offset);

    return this.db
      .query(`SELECT * FROM home_tasks ${where}ORDER BY created_at ASC LIMIT ? OFFSET ?`)
      .all(...params) as HomeTask[];
  }

  count(filter?: Omit<HomeTaskFilter, "limit" | "offset">): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.status) {
      const statuses = filter.status.split(",");
      if (statuses.length === 1) {
        conditions.push("status = ?");
        params.push(statuses[0]);
      } else {
        conditions.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }
    }
    if (filter?.area) {
      conditions.push("area = ?");
      params.push(filter.area);
    }
    if (filter?.effort) {
      conditions.push("effort = ?");
      params.push(filter.effort);
    }
    if (filter?.title) {
      conditions.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filter.title)}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";

    return (
      this.db
        .query(`SELECT COUNT(*) as total FROM home_tasks ${where}`)
        .get(...params) as { total: number }
    ).total;
  }

  insertMany(rows: Omit<HomeTask, "id" | "created_at" | "updated_at">[]): HomeTask[] {
    const stmt = this.db.query(
      "INSERT INTO home_tasks (id, title, description, status, area, effort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const now = new Date().toISOString();
    const ids: string[] = [];

    for (const row of rows) {
      const id = ulid();
      ids.push(id);
      stmt.run(id, row.title, row.description ?? null, row.status, row.area ?? null, row.effort ?? null, now, now);
    }

    return ids.map((id) => this.findById(id)!);
  }

  updateMany(rows: { id: string; title?: string; description?: string | null; status?: string; area?: string | null; effort?: string | null }[]): HomeTask[] {
    const now = new Date().toISOString();
    const results: HomeTask[] = [];

    for (const row of rows) {
      const existing = this.findById(row.id);
      if (!existing) continue;

      const title = row.title !== undefined ? row.title : existing.title;
      const description = row.description !== undefined ? row.description : existing.description;
      const status = row.status !== undefined ? row.status : existing.status;
      const area = row.area !== undefined ? row.area : existing.area;
      const effort = row.effort !== undefined ? row.effort : existing.effort;

      this.db
        .query("UPDATE home_tasks SET title = ?, description = ?, status = ?, area = ?, effort = ?, updated_at = ? WHERE id = ?")
        .run(title, description, status, area, effort, now, row.id);

      results.push(this.findById(row.id)!);
    }

    return results;
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    this.db.query(`DELETE FROM home_tasks WHERE id IN (${placeholders})`).run(...ids);
    return (this.db.query("SELECT changes() as c").get() as { c: number }).c;
  }
}
