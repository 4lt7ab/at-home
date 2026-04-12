import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { Note, NoteType } from "../entities";

export interface NoteFilter {
  id?: string;
  task_id?: string;
  title?: string;
  note_type?: NoteType;
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
    if (filter?.task_id !== undefined) {
      if (filter.task_id === "null" || filter.task_id === "") {
        parts.push(this.sql`task_id IS NULL`);
      } else {
        parts.push(this.sql`task_id = ${filter.task_id}`);
      }
    }
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);
    if (filter?.note_type) parts.push(this.sql`note_type = ${filter.note_type}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<Note[]>`
      SELECT * FROM notes ${where}
      ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async findByTaskId(taskId: string): Promise<Note[]> {
    return await this.sql<Note[]>`SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC`;
  }

  async count(filter?: Omit<NoteFilter, "limit" | "offset">): Promise<number> {
    const parts: any[] = [];

    if (filter?.id) parts.push(this.sql`id = ${filter.id}`);
    if (filter?.task_id !== undefined) {
      if (filter.task_id === "null" || filter.task_id === "") {
        parts.push(this.sql`task_id IS NULL`);
      } else {
        parts.push(this.sql`task_id = ${filter.task_id}`);
      }
    }
    if (filter?.title) parts.push(this.sql`title ILIKE ${"%" + escapeLike(filter.title) + "%"}`);
    if (filter?.note_type) parts.push(this.sql`note_type = ${filter.note_type}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM notes ${where}`;
    return row.total;
  }

  async insertMany(rows: { task_id?: string | null; title: string; content?: string | null; note_type?: string }[]): Promise<Note[]> {
    const now = new Date().toISOString();
    const results: Note[] = [];

    for (const row of rows) {
      const id = ulid();
      const [inserted] = await this.sql<Note[]>`
        INSERT INTO notes (id, task_id, title, content, note_type, created_at, updated_at)
        VALUES (${id}, ${row.task_id ?? null}, ${row.title}, ${row.content ?? null}, ${row.note_type ?? "manual"}, ${now}, ${now})
        RETURNING *
      `;
      results.push(inserted);
    }

    return results;
  }

  async updateMany(rows: { id: string; task_id?: string | null; title?: string; content?: string | null }[]): Promise<Note[]> {
    const now = new Date().toISOString();
    const results: Note[] = [];

    for (const row of rows) {
      const existing = await this.findById(row.id);
      if (!existing) continue;

      const task_id = row.task_id !== undefined ? row.task_id : existing.task_id;
      const title = row.title !== undefined ? row.title : existing.title;
      const content = row.content !== undefined ? row.content : existing.content;

      const [updated] = await this.sql<Note[]>`
        UPDATE notes SET task_id = ${task_id}, title = ${title}, content = ${content}, updated_at = ${now}
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
