import type { LogEntry, LogEntrySummary } from "../entities";
import { toLogEntrySummary } from "../entities";
import type { CreateLogEntryInput, UpdateLogEntryInput } from "../inputs";
import type { ILogEntryService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { LogRepository } from "../repositories/logs";
import type { LogEntryRepository, LogEntryFilter } from "../repositories/log-entries";
import type { EventBus } from "../events";

const METADATA_MAX_BYTES = 64 * 1024; // 64 KiB sanity check

function isValidISODateTime(s: string): boolean {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

export class LogEntryService implements ILogEntryService {
  constructor(
    private logEntryRepo: LogEntryRepository,
    private logRepo: LogRepository,
    private eventBus: EventBus,
  ) {}

  async list(filter?: LogEntryFilter): Promise<Paginated<LogEntrySummary>> {
    const [data, total] = await Promise.all([
      this.logEntryRepo.findMany(filter),
      this.logEntryRepo.count(filter),
    ]);
    return { data: data.map(toLogEntrySummary), total };
  }

  async get(id: string): Promise<LogEntry> {
    const entry = await this.logEntryRepo.findById(id);
    if (!entry) throw new ServiceError("log entry not found", 404);
    return entry;
  }

  async create(inputs: CreateLogEntryInput[]): Promise<LogEntry[]> {
    const now = new Date().toISOString();
    const rows: { log_id: string; occurred_at: string; note: string | null; metadata: Record<string, unknown> | null }[] = [];

    for (const input of inputs) {
      if (!input.log_id) {
        throw new ServiceError("log_id is required", 400);
      }
      const parent = await this.logRepo.findById(input.log_id);
      if (!parent) throw new ServiceError(`log not found: ${input.log_id}`, 404);

      const occurred_at = input.occurred_at ?? now;
      if (!isValidISODateTime(occurred_at)) {
        throw new ServiceError("occurred_at must be a valid ISO datetime", 400);
      }

      if (input.note != null && input.note.length > 50000) {
        throw new ServiceError("note must be 50000 characters or fewer", 400);
      }

      if (input.metadata != null) {
        if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
          throw new ServiceError("metadata must be a JSON object", 400);
        }
        const size = Buffer.byteLength(JSON.stringify(input.metadata), "utf-8");
        if (size > METADATA_MAX_BYTES) {
          throw new ServiceError(`metadata must be ${METADATA_MAX_BYTES} bytes or fewer`, 400);
        }
      }

      rows.push({
        log_id: input.log_id,
        occurred_at: new Date(occurred_at).toISOString(),
        note: input.note ?? null,
        metadata: input.metadata ?? null,
      });
    }

    const entries = await this.logEntryRepo.insertMany(rows);
    this.eventBus.emit({ type: "created", entity_type: "log_entry", payload: entries });
    return entries;
  }

  async update(inputs: UpdateLogEntryInput[]): Promise<LogEntry[]> {
    for (const input of inputs) {
      const existing = await this.logEntryRepo.findById(input.id);
      if (!existing) throw new ServiceError(`log entry not found: ${input.id}`, 404);

      if (input.occurred_at !== undefined && !isValidISODateTime(input.occurred_at)) {
        throw new ServiceError("occurred_at must be a valid ISO datetime", 400);
      }
      if (input.note !== undefined && input.note !== null && input.note.length > 50000) {
        throw new ServiceError("note must be 50000 characters or fewer", 400);
      }
      if (input.metadata !== undefined && input.metadata !== null) {
        if (typeof input.metadata !== "object" || Array.isArray(input.metadata)) {
          throw new ServiceError("metadata must be a JSON object", 400);
        }
        const size = Buffer.byteLength(JSON.stringify(input.metadata), "utf-8");
        if (size > METADATA_MAX_BYTES) {
          throw new ServiceError(`metadata must be ${METADATA_MAX_BYTES} bytes or fewer`, 400);
        }
      }
    }

    const normalized = inputs.map((input) => ({
      ...input,
      occurred_at: input.occurred_at !== undefined
        ? new Date(input.occurred_at).toISOString()
        : undefined,
    }));

    const entries = await this.logEntryRepo.updateMany(normalized);
    this.eventBus.emit({ type: "updated", entity_type: "log_entry", payload: entries });
    return entries;
  }

  async remove(ids: string[]): Promise<number> {
    const deleted = await this.logEntryRepo.deleteMany(ids);
    this.eventBus.emit({ type: "deleted", entity_type: "log_entry", ids });
    return deleted;
  }
}
