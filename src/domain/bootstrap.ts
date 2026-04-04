import type { Database } from "bun:sqlite";
import { createDatabase } from "./db/connection";
import { runMigrations } from "./db/migrator";
import { HomeTaskRepository } from "./repositories/home-tasks";
import { NoteRepository } from "./repositories/notes";
import { ScheduleRepository } from "./repositories/schedules";
import { ActivityLogRepository } from "./repositories/activity-log";
import { HomeTaskService } from "./services/home-tasks";
import { NoteService } from "./services/notes";
import { ScheduleService } from "./services/schedules";
import { EventBus } from "./events";

export interface AppContext {
  db: Database;
  eventBus: EventBus;
  homeTaskRepo: HomeTaskRepository;
  noteRepo: NoteRepository;
  scheduleRepo: ScheduleRepository;
  activityLogRepo: ActivityLogRepository;
  homeTaskService: HomeTaskService;
  noteService: NoteService;
  scheduleService: ScheduleService;
}

export async function bootstrap(dbPath?: string): Promise<AppContext> {
  const db = createDatabase(dbPath);
  await runMigrations(db);

  const homeTaskRepo = new HomeTaskRepository(db);
  const noteRepo = new NoteRepository(db);
  const scheduleRepo = new ScheduleRepository(db);
  const activityLogRepo = new ActivityLogRepository(db);

  const eventBus = new EventBus();

  const homeTaskService = new HomeTaskService(homeTaskRepo, scheduleRepo, noteRepo, activityLogRepo, eventBus);
  const noteService = new NoteService(noteRepo, homeTaskRepo, activityLogRepo, eventBus);
  const scheduleService = new ScheduleService(scheduleRepo, homeTaskRepo, activityLogRepo, eventBus);

  return { db, eventBus, homeTaskRepo, noteRepo, scheduleRepo, activityLogRepo, homeTaskService, noteService, scheduleService };
}
