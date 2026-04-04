import type { Database } from "bun:sqlite";
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
  constructor(private db: Database) {}

  findById(id: string): Note | null {
    return this.db.query("SELECT * FROM notes WHERE id = ?").get(id) as Note | null;
  }

  findMany(filter?: NoteFilter): Note[] {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.task_id !== undefined) {
      if (filter.task_id === "null" || filter.task_id === "") {
        conditions.push("task_id IS NULL");
      } else {
        conditions.push("task_id = ?");
        params.push(filter.task_id);
      }
    }
    if (filter?.title) {
      conditions.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filter.title)}%`);
    }
    if (filter?.note_type) {
      conditions.push("note_type = ?");
      params.push(filter.note_type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";
    params.push(limit, offset);

    return this.db
      .query(`SELECT * FROM notes ${where}ORDER BY created_at ASC LIMIT ? OFFSET ?`)
      .all(...params) as Note[];
  }

  findByTaskId(taskId: string): Note[] {
    return this.db
      .query("SELECT * FROM notes WHERE task_id = ? ORDER BY created_at ASC")
      .all(taskId) as Note[];
  }

  count(filter?: Omit<NoteFilter, "limit" | "offset">): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filter?.id) {
      conditions.push("id = ?");
      params.push(filter.id);
    }
    if (filter?.task_id !== undefined) {
      if (filter.task_id === "null" || filter.task_id === "") {
        conditions.push("task_id IS NULL");
      } else {
        conditions.push("task_id = ?");
        params.push(filter.task_id);
      }
    }
    if (filter?.title) {
      conditions.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filter.title)}%`);
    }
    if (filter?.note_type) {
      conditions.push("note_type = ?");
      params.push(filter.note_type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";

    return (
      this.db
        .query(`SELECT COUNT(*) as total FROM notes ${where}`)
        .get(...params) as { total: number }
    ).total;
  }

  insertMany(rows: { task_id?: string | null; title: string; content?: string | null; note_type?: string }[]): Note[] {
    const stmt = this.db.query(
      "INSERT INTO notes (id, task_id, title, content, note_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const now = new Date().toISOString();
    const ids: string[] = [];

    for (const row of rows) {
      const id = ulid();
      ids.push(id);
      stmt.run(id, row.task_id ?? null, row.title, row.content ?? null, row.note_type ?? "manual", now, now);
    }

    return ids.map((id) => this.findById(id)!);
  }

  updateMany(rows: { id: string; task_id?: string | null; title?: string; content?: string | null }[]): Note[] {
    const now = new Date().toISOString();
    const results: Note[] = [];

    for (const row of rows) {
      const existing = this.findById(row.id);
      if (!existing) continue;

      const task_id = row.task_id !== undefined ? row.task_id : existing.task_id;
      const title = row.title !== undefined ? row.title : existing.title;
      const content = row.content !== undefined ? row.content : existing.content;

      this.db
        .query("UPDATE notes SET task_id = ?, title = ?, content = ?, updated_at = ? WHERE id = ?")
        .run(task_id, title, content, now, row.id);

      results.push(this.findById(row.id)!);
    }

    return results;
  }

  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    this.db.query(`DELETE FROM notes WHERE id IN (${placeholders})`).run(...ids);
    return (this.db.query("SELECT changes() as c").get() as { c: number }).c;
  }
}
