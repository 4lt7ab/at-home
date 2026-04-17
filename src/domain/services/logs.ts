import type { Log, LogSummary } from "../entities";
import { toLogSummary } from "../entities";
import type { CreateLogInput, UpdateLogInput } from "../inputs";
import type { ILogService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { LogRepository, LogFilter } from "../repositories/logs";
import type { EventBus } from "../events";

export class LogService implements ILogService {
  constructor(
    private logRepo: LogRepository,
    private eventBus: EventBus,
  ) {}

  async list(filter?: LogFilter): Promise<Paginated<LogSummary>> {
    const [data, total] = await Promise.all([
      this.logRepo.findMany(filter),
      this.logRepo.count(filter),
    ]);
    const projections = await this.logRepo.projectionsForIds(data.map((l) => l.id));
    return {
      data: data.map((l) => toLogSummary(l, projections.get(l.id) ?? { last_logged_at: null, entry_count: 0 })),
      total,
    };
  }

  async get(id: string): Promise<Log> {
    const log = await this.logRepo.findById(id);
    if (!log) throw new ServiceError("log not found", 404);
    return log;
  }

  async create(inputs: CreateLogInput[]): Promise<Log[]> {
    for (const input of inputs) {
      if (!input.name?.trim()) {
        throw new ServiceError("name is required", 400);
      }
      if (input.name.length > 255) {
        throw new ServiceError("name must be 255 characters or fewer", 400);
      }
      if (input.description != null && input.description.length > 50000) {
        throw new ServiceError("description must be 50000 characters or fewer", 400);
      }
    }

    const rows = inputs.map((input) => ({
      name: input.name,
      description: input.description ?? null,
    }));

    const logs = await this.logRepo.insertMany(rows);
    this.eventBus.emit({ type: "created", entity_type: "log", payload: logs });
    return logs;
  }

  async update(inputs: UpdateLogInput[]): Promise<Log[]> {
    for (const input of inputs) {
      const existing = await this.logRepo.findById(input.id);
      if (!existing) throw new ServiceError(`log not found: ${input.id}`, 404);

      if (input.name !== undefined && !input.name.trim()) {
        throw new ServiceError("name cannot be empty", 400);
      }
      if (input.name !== undefined && input.name.length > 255) {
        throw new ServiceError("name must be 255 characters or fewer", 400);
      }
      if (input.description !== undefined && input.description !== null && input.description.length > 50000) {
        throw new ServiceError("description must be 50000 characters or fewer", 400);
      }
    }

    const logs = await this.logRepo.updateMany(inputs);
    this.eventBus.emit({ type: "updated", entity_type: "log", payload: logs });
    return logs;
  }

  async remove(ids: string[]): Promise<number> {
    const deleted = await this.logRepo.deleteMany(ids);
    this.eventBus.emit({ type: "deleted", entity_type: "log", ids });
    return deleted;
  }
}
