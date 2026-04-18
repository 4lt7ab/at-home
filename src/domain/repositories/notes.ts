import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { Note } from "../entities";

export interface NoteFilter {
  id?: string;
  title?: string;
  limit?: number;
  offset?: number;
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

export class NoteRepository {
  constructor(private sql: Sql) {}

  async findById(id: string): Promise<Note | null> {
    const [row] = await this.sql<Note[]>`SELECT * FROM notes WHERE id = ${id}`;
    return row ?? null;
  }

  async findMany(filter?: NoteFilter): Promise<Note[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<Note[]>`
      SELECT * FROM notes ${where}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: Omit<NoteFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM notes ${where}`;
    return row.total;
  }

  async insertMany(rows: { title: string; context?: string | null }[]): Promise<Note[]> {
    const now = new Date().toISOString();
    const results: Note[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<Note[]>`
        INSERT INTO notes (id, title, context, created_at, updated_at)
        VALUES (${id}, ${row.title}, ${row.context ?? null}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(rows: { id: string; title?: string; context?: string | null }[]): Promise<Note[]> {
    const now = new Date().toISOString();
    const results: Note[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const title = row.title !== undefined ? row.title : existing.title;
      const context = row.context !== undefined ? row.context : existing.context;

      const [updated] = await this.sql<Note[]>`
        UPDATE notes SET title = ${title}, context = ${context}, updated_at = ${now}
        WHERE id = ${row.id}
        RETURNING *
      `;
      results.push(updated);
    }

    return results;
  }

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.sql`DELETE FROM notes WHERE id = ANY(${ids})`;
    return result.count;
  }
}
