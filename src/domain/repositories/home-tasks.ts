import type { Sql } from "../db/connection";
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
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<HomeTask | null> {
    const [row] = await this.sql<HomeTask[]>`SELECT * FROM home_tasks WHERE id = ${id}`;
    return row ?? null;
  }

  async findMany(filter?: HomeTaskFilter): Promise<HomeTask[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.status) {
      const statuses = filter.status.split(",");
      parts.push(this.sql`status = ANY(${statuses})`);
    }
    if (filter?.area) parts.push(this.sql`area = ${filter.area}`);
    if (filter?.effort) parts.push(this.sql`effort = ${filter.effort}`);
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<HomeTask[]>`
      SELECT * FROM home_tasks ${where}
      ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: Omit<HomeTaskFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.status) {
      const statuses = filter.status.split(",");
      parts.push(this.sql`status = ANY(${statuses})`);
    }
    if (filter?.area) parts.push(this.sql`area = ${filter.area}`);
    if (filter?.effort) parts.push(this.sql`effort = ${filter.effort}`);
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM home_tasks ${where}`;
    return row.total;
  }

  async insertMany(rows: Omit<HomeTask, "id" | "created_at" | "updated_at">[]): Promise<HomeTask[]> {
    const now = new Date().toISOString();
    const results: HomeTask[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<HomeTask[]>`
        INSERT INTO home_tasks (id, title, description, status, area, effort, created_at, updated_at)
        VALUES (${id}, ${row.title}, ${row.description ?? null}, ${row.status}, ${row.area ?? null}, ${row.effort ?? null}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(rows: { id: string; title?: string; description?: string | null; status?: string; area?: string | null; effort?: string | null }[]): Promise<HomeTask[]> {
    const now = new Date().toISOString();
    const results: HomeTask[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const title = row.title !== undefined ? row.title : existing.title;
      const description = row.description !== undefined ? row.description : existing.description;
      const status = row.status !== undefined ? row.status : existing.status;
      const area = row.area !== undefined ? row.area : existing.area;
      const effort = row.effort !== undefined ? row.effort : existing.effort;

      const [updated] = await this.sql<HomeTask[]>`
        UPDATE home_tasks SET title = ${title}, description = ${description}, status = ${status},
          area = ${area}, effort = ${effort}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM home_tasks WHERE id = ANY(${ids})`;
    return result.count;
  }
}
