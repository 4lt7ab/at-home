import type { Sql } from "./db/connection";
import { createSql } from "./db/connection";
import { runMigrations } from "./db/migrator";
import { NoteRepository } from "./repositories/notes";
import { NoteService } from "./services/notes";
import { EventBus } from "./events";

export interface AppContext {
  sql: Sql;
  eventBus: EventBus;
  noteRepo: NoteRepository;
  noteService: NoteService;
}

export async function bootstrap(databaseUrl?: string): Promise<AppContext> {
  const sql = createSql(databaseUrl);
  await runMigrations(sql);

  const noteRepo = new NoteRepository(sql);
  const eventBus = new EventBus();
  const noteService = new NoteService(noteRepo, eventBus);

  return { sql, eventBus, noteRepo, noteService };
}
