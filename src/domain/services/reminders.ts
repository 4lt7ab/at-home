import type { Reminder, ReminderSummary, Recurrence } from "../entities";
import { toReminderSummary } from "../entities";
import type { CreateReminderInput, UpdateReminderInput, DismissReminderInput } from "../inputs";
import type { IReminderService, Paginated } from "../services";
import { ServiceError } from "../errors";
import type { ReminderRepository, ReminderFilter } from "../repositories/reminders";
import type { EventBus } from "../events";

const VALID_RECURRENCES: Recurrence[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

function isValidISODateTime(s: string): boolean {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function advanceRemindAt(remindAt: string, recurrence: Recurrence): string {
  const d = new Date(remindAt);
  switch (recurrence) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString();
}

export class ReminderService implements IReminderService {
  constructor(
    private reminderRepo: ReminderRepository,
    private eventBus: EventBus,
  ) {}

  async list(filter?: ReminderFilter): Promise<Paginated<ReminderSummary>> {
    const [data, total] = await Promise.all([
      this.reminderRepo.findMany(filter),
      this.reminderRepo.count(filter),
    ]);
    return { data: data.map(toReminderSummary), total };
  }

  async get(id: string): Promise<Reminder> {
    const reminder = await this.reminderRepo.findById(id);
    if (!reminder) throw new ServiceError("reminder not found", 404);
    return reminder;
  }

  async create(inputs: CreateReminderInput[]): Promise<Reminder[]> {
    for (const input of inputs) {
      if (!input.context?.trim()) {
        throw new ServiceError("context is required", 400);
      }
      if (input.context.length > 50000) {
        throw new ServiceError("context must be 50000 characters or fewer", 400);
      }
      if (!input.remind_at || !isValidISODateTime(input.remind_at)) {
        throw new ServiceError("remind_at must be a valid ISO datetime", 400);
      }
      if (input.recurrence !== undefined && !VALID_RECURRENCES.includes(input.recurrence)) {
        throw new ServiceError("recurrence must be one of: weekly, biweekly, monthly, yearly", 400);
      }
    }

    const rows = inputs.map((input) => ({
      context: input.context,
      remind_at: input.remind_at,
      recurrence: input.recurrence ?? null,
    }));

    const reminders = await this.reminderRepo.insertMany(rows);
    this.eventBus.emit({ type: "created", entity_type: "reminder", payload: reminders });
    return reminders;
  }

  async update(inputs: UpdateReminderInput[]): Promise<Reminder[]> {
    for (const input of inputs) {
      const existing = await this.reminderRepo.findById(input.id);
      if (!existing) throw new ServiceError(`reminder not found: ${input.id}`, 404);

      if (input.context !== undefined && !input.context.trim()) {
        throw new ServiceError("context cannot be empty", 400);
      }
      if (input.context !== undefined && input.context.length > 50000) {
        throw new ServiceError("context must be 50000 characters or fewer", 400);
      }
      if (input.remind_at !== undefined && !isValidISODateTime(input.remind_at)) {
        throw new ServiceError("remind_at must be a valid ISO datetime", 400);
      }
      if (input.recurrence !== undefined && input.recurrence !== null && !VALID_RECURRENCES.includes(input.recurrence)) {
        throw new ServiceError("recurrence must be one of: weekly, biweekly, monthly, yearly", 400);
      }
    }

    const reminders = await this.reminderRepo.updateMany(inputs);
    this.eventBus.emit({ type: "updated", entity_type: "reminder", payload: reminders });
    return reminders;
  }

  async remove(ids: string[]): Promise<number> {
    const deleted = await this.reminderRepo.deleteMany(ids);
    this.eventBus.emit({ type: "deleted", entity_type: "reminder", ids });
    return deleted;
  }

  async dismiss(input: DismissReminderInput): Promise<Reminder> {
    const existing = await this.reminderRepo.findById(input.id);
    if (!existing) throw new ServiceError("reminder not found", 404);

    if (input.remind_at !== undefined && !isValidISODateTime(input.remind_at)) {
      throw new ServiceError("remind_at must be a valid ISO datetime", 400);
    }

    const now = new Date().toISOString();
    const update: { id: string; dismissed_at: string; remind_at?: string } = {
      id: input.id,
      dismissed_at: now,
    };

    if (input.remind_at) {
      // Override provided — use it as next remind_at
      update.remind_at = input.remind_at;
    } else if (existing.recurrence) {
      // Recurring with no override — advance remind_at from current remind_at
      update.remind_at = advanceRemindAt(existing.remind_at, existing.recurrence);
    } else if (existing.remind_at > now) {
      // Non-recurring dismissed early — snap remind_at to now so dormant condition holds
      update.remind_at = now;
    }
    // Non-recurring with remind_at already in the past — dormant naturally (dismissed_at >= remind_at)

    const [reminder] = await this.reminderRepo.updateMany([update]);
    this.eventBus.emit({ type: "updated", entity_type: "reminder", payload: [reminder] });
    return reminder;
  }
}
