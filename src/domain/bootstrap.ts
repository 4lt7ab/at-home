import type { Sql } from "./db/connection";
import { createSql } from "./db/connection";
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
  sql: Sql;
  eventBus: EventBus;
  homeTaskRepo: HomeTaskRepository;
  noteRepo: NoteRepository;
  scheduleRepo: ScheduleRepository;
  activityLogRepo: ActivityLogRepository;
  homeTaskService: HomeTaskService;
  noteService: NoteService;
  scheduleService: ScheduleService;
}

export async function bootstrap(databaseUrl?: string): Promise<AppContext> {
  const sql = createSql(databaseUrl);
  await runMigrations(sql);

  const homeTaskRepo = new HomeTaskRepository(sql);
  const noteRepo = new NoteRepository(sql);
  const scheduleRepo = new ScheduleRepository(sql);
  const activityLogRepo = new ActivityLogRepository(sql);

  const eventBus = new EventBus();

  const homeTaskService = new HomeTaskService(homeTaskRepo, scheduleRepo, noteRepo, activityLogRepo, eventBus);
  const noteService = new NoteService(noteRepo, homeTaskRepo, activityLogRepo, eventBus);
  const scheduleService = new ScheduleService(scheduleRepo, homeTaskRepo, activityLogRepo, eventBus);

  return { sql, eventBus, homeTaskRepo, noteRepo, scheduleRepo, activityLogRepo, homeTaskService, noteService, scheduleService };
}
