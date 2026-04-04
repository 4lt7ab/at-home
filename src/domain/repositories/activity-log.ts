import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import type { ActivityLog, EntityType, ActivityAction } from "../entities";

export interface InsertActivityLog {
  entity_type: EntityType;
  entity_id: string | null;
  action: ActivityAction;
  summary: string;
}

export class ActivityLogRepository {
  constructor(private db: Database) {}

  insert(row: InsertActivityLog): ActivityLog {
    const id = ulid();
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO activity_log (id, entity_type, entity_id, action, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(id, row.entity_type, row.entity_id, row.action, row.summary, now);
    return this.db.query("SELECT * FROM activity_log WHERE id = ?").get(id) as ActivityLog;
  }

  findMany(filter?: {
    entity_type?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
  }): ActivityLog[] {
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.entity_type) {
      conditions.push("entity_type = ?");
      params.push(filter.entity_type);
    }
    if (filter?.entity_id) {
      conditions.push("entity_id = ?");
      params.push(filter.entity_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";
    params.push(limit, offset);

    return this.db
      .query(`SELECT * FROM activity_log ${where}ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params) as ActivityLog[];
  }

  count(filter?: { entity_type?: string; entity_id?: string }): number {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filter?.entity_type) {
      conditions.push("entity_type = ?");
      params.push(filter.entity_type);
    }
    if (filter?.entity_id) {
      conditions.push("entity_id = ?");
      params.push(filter.entity_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")} ` : "";

    return (
      this.db
        .query(`SELECT COUNT(*) as total FROM activity_log ${where}`)
        .get(...params) as { total: number }
    ).total;
  }
}
