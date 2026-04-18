import type { Sql } from "../db/connection";
import type { LogEntryReaction } from "../entities";

export class LogEntryReactionRepository {
  constructor(private sql: Sql) {}

  /** Return all reactions for a single log entry, ordered by emoji for stability. */
  async list(log_entry_id: string): Promise<LogEntryReaction[]> {
    return await this.sql<LogEntryReaction[]>`
      SELECT log_entry_id, emoji, count, created_at, updated_at
      FROM log_entry_reactions
      WHERE log_entry_id = ${log_entry_id}
      ORDER BY emoji ASC
    `;
  }

  /**
   * Upsert-increment: insert a new row with count=1, or bump count by 1 on conflict.
   * Returns the resulting row.
   */
  async upsertIncrement(log_entry_id: string, emoji: string): Promise<LogEntryReaction> {
    const now = new Date().toISOString();
    const [row] = await this.sql<LogEntryReaction[]>`
      INSERT INTO log_entry_reactions (log_entry_id, emoji, count, created_at, updated_at)
      VALUES (${log_entry_id}, ${emoji}, 1, ${now}, ${now})
      ON CONFLICT (log_entry_id, emoji)
      DO UPDATE SET count = log_entry_reactions.count + 1, updated_at = ${now}
      RETURNING log_entry_id, emoji, count, created_at, updated_at
    `;
    return row;
  }

  /**
   * Compute reactions projection for a batch of log entry ids in a single query.
   * Returns a Map keyed by log_entry_id. Entries with no reactions get an empty array.
   */
  async projectionsForIds(ids: string[]): Promise<Map<string, Array<{ emoji: string; count: number }>>> {
    const result = new Map<string, Array<{ emoji: string; count: number }>>();
    if (ids.length === 0) return result;

    const rows = await this.sql<{ log_entry_id: string; emoji: string; count: number }[]>`
      SELECT log_entry_id, emoji, count
      FROM log_entry_reactions
      WHERE log_entry_id = ANY(${ids})
      ORDER BY log_entry_id, emoji ASC
    `;

    for (const id of ids) {
      result.set(id, []);
    }
    for (const row of rows) {
      result.get(row.log_entry_id)!.push({ emoji: row.emoji, count: row.count });
    }
    return result;
  }
}
