import type { Sql } from "./db/connection";
import { createSql } from "./db/connection";
import { runMigrations } from "./db/migrator";
import { NoteRepository } from "./repositories/notes";
import { NoteService } from "./services/notes";
import { ReminderRepository } from "./repositories/reminders";
import { ReminderService } from "./services/reminders";
import { EventBus } from "./events";

export interface AppContext {
  sql: Sql;
  eventBus: EventBus;
  noteRepo: NoteRepository;
  noteService: NoteService;
  reminderRepo: ReminderRepository;
  reminderService: ReminderService;
}

export async function bootstrap(databaseUrl?: string): Promise<AppContext> {
  const sql = createSql(databaseUrl);
  await runMigrations(sql);

  const eventBus = new EventBus();
  const noteRepo = new NoteRepository(sql);
  const noteService = new NoteService(noteRepo, eventBus);
  const reminderRepo = new ReminderRepository(sql);
  const reminderService = new ReminderService(reminderRepo, eventBus);

  return { sql, eventBus, noteRepo, noteService, reminderRepo, reminderService };
}
