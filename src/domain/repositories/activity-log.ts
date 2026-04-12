import type { Sql } from "../db/connection";
import { ulid } from "ulid";
import type { ActivityLog, EntityType, ActivityAction } from "../entities";

export interface InsertActivityLog {
  entity_type: EntityType;
  entity_id: string | null;
  action: ActivityAction;
  summary: string;
}

export class ActivityLogRepository {
  constructor(private sql: Sql) {}

  async insert(row: InsertActivityLog): Promise<ActivityLog> {
    const id = ulid();
    const now = new Date().toISOString();
    const [inserted] = await this.sql<ActivityLog[]>`
      INSERT INTO activity_log (id, entity_type, entity_id, action, summary, created_at)
      VALUES (${id}, ${row.entity_type}, ${row.entity_id}, ${row.action}, ${row.summary}, ${now})
      RETURNING *
    `;
    return inserted;
  }

  async findMany(filter?: {
    entity_type?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityLog[]> {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const parts: any[] = [];

    if (filter?.entity_type) parts.push(this.sql`entity_type = ${filter.entity_type}`);
    if (filter?.entity_id) parts.push(this.sql`entity_id = ${filter.entity_id}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    return await this.sql<ActivityLog[]>`
      SELECT * FROM activity_log ${where}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(filter?: { entity_type?: string; entity_id?: string }): Promise<number> {
    const parts: any[] = [];

    if (filter?.entity_type) parts.push(this.sql`entity_type = ${filter.entity_type}`);
    if (filter?.entity_id) parts.push(this.sql`entity_id = ${filter.entity_id}`);

    const where = parts.length > 0
      ? this.sql`WHERE ${parts.reduce((a, b) => this.sql`${a} AND ${b}`)}`
      : this.sql``;

    const [row] = await this.sql<{ total: number }[]>`SELECT COUNT(*)::int as total FROM activity_log ${where}`;
    return row.total;
  }
}
