import type { Schedule, ScheduleSummary } from "../entities";
import { RECURRENCE_TYPES, toScheduleSummary } from "../entities";
import type { CreateScheduleInput, UpdateScheduleInput } from "../inputs";
import type { IScheduleService, Paginated } from "../services";
import { ServiceError } from "../errors";
import { parseRule, nextDue, isValidDateString } from "../recurrence";
import type { ScheduleRepository } from "../repositories/schedules";
import type { HomeTaskRepository } from "../repositories/home-tasks";
import type { ActivityLogRepository } from "../repositories/activity-log";
import type { EventBus } from "../events";

/** Format a Date as YYYY-MM-DD. */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export class ScheduleService implements IScheduleService {
  constructor(
    private scheduleRepo: ScheduleRepository,
    private homeTaskRepo: HomeTaskRepository,
    private activityLog: ActivityLogRepository,
    private eventBus: EventBus,
  ) {}

  list(filter?: {
    id?: string;
    task_id?: string;
    recurrence_type?: string;
    limit?: number;
    offset?: number;
  }): Paginated<ScheduleSummary> {
    return {
      data: this.scheduleRepo.findMany(filter).map(toScheduleSummary),
      total: this.scheduleRepo.count(filter),
    };
  }

  get(id: string): Schedule {
    const schedule = this.scheduleRepo.findById(id);
    if (!schedule) throw new ServiceError("schedule not found", 404);
    return schedule;
  }

  create(inputs: CreateScheduleInput[]): Schedule[] {
    for (const input of inputs) {
      // Validate task_id references an existing home_task
      if (!input.task_id?.trim()) {
        throw new ServiceError("task_id is required", 400);
      }
      const task = this.homeTaskRepo.findById(input.task_id);
      if (!task) {
        throw new ServiceError(`home_task not found: ${input.task_id}`, 404);
      }

      // Enforce one schedule per task
      const existing = this.scheduleRepo.findByTaskId(input.task_id);
      if (existing) {
        throw new ServiceError(
          `task ${input.task_id} already has a schedule (${existing.id})`,
          400
        );
      }

      // Validate recurrence_type
      if (
        !(RECURRENCE_TYPES as readonly string[]).includes(input.recurrence_type)
      ) {
        throw new ServiceError(
          `recurrence_type must be one of: ${(RECURRENCE_TYPES as readonly string[]).join(", ")}`,
          400
        );
      }

      // Validate recurrence_rule if provided
      if (input.recurrence_rule) {
        const parsedRule = parseRule(input.recurrence_rule); // throws ServiceError on invalid

        // Enforce consistency between recurrence_type and recurrence_rule
        if (parsedRule.type !== input.recurrence_type) {
          throw new ServiceError(
            `recurrence_type '${input.recurrence_type}' does not match recurrence_rule type '${parsedRule.type}'`,
            400
          );
        }
      }

      // Validate next_due if provided
      if (input.next_due !== undefined && input.next_due !== null) {
        if (!isValidDateString(input.next_due)) {
          throw new ServiceError("next_due must be a valid ISO date (YYYY-MM-DD)", 400);
        }
      }

      // A one-off schedule must have next_due
      if (input.recurrence_type === "once" && !input.next_due && !input.recurrence_rule) {
        throw new ServiceError(
          "a 'once' schedule requires either next_due or a recurrence_rule with a date",
          400
        );
      }
    }

    const rows = inputs.map((input) => {
      let computedNextDue = input.next_due ?? null;

      // Auto-compute next_due from recurrence_rule if not provided
      if (!computedNextDue && input.recurrence_rule) {
        const rule = parseRule(input.recurrence_rule);
        const nd = nextDue(rule, new Date());
        if (nd) {
          computedNextDue = formatDate(nd);
        }
      }

      return {
        task_id: input.task_id,
        recurrence_type: input.recurrence_type,
        recurrence_rule: input.recurrence_rule ?? null,
        next_due: computedNextDue,
        last_completed: null,
      };
    });

    const schedules = this.scheduleRepo.insertMany(rows);
    for (const s of schedules) {
      this.activityLog.insert({
        entity_type: "schedule",
        entity_id: s.id,
        action: "created",
        summary: JSON.stringify({
          task_id: s.task_id,
          recurrence_type: s.recurrence_type,
        }),
      });
    }
    this.eventBus.emit({
      type: "created",
      entity_type: "schedule",
      payload: schedules,
    });
    return schedules;
  }

  update(inputs: UpdateScheduleInput[]): Schedule[] {
    for (const input of inputs) {
      const existing = this.scheduleRepo.findById(input.id);
      if (!existing) throw new ServiceError(`schedule not found: ${input.id}`, 404);

      // Validate recurrence_type if provided
      if (
        input.recurrence_type !== undefined &&
        !(RECURRENCE_TYPES as readonly string[]).includes(input.recurrence_type)
      ) {
        throw new ServiceError(
          `recurrence_type must be one of: ${(RECURRENCE_TYPES as readonly string[]).join(", ")}`,
          400
        );
      }

      // Validate recurrence_rule if provided (and not null — null clears it)
      if (input.recurrence_rule !== undefined && input.recurrence_rule !== null) {
        parseRule(input.recurrence_rule); // throws ServiceError on invalid
      }

      // Enforce recurrence_type / recurrence_rule consistency
      if (input.recurrence_rule !== undefined && input.recurrence_rule !== null) {
        const parsedRule = parseRule(input.recurrence_rule);
        const effectiveType = input.recurrence_type ?? existing.recurrence_type;
        if (effectiveType !== parsedRule.type) {
          throw new ServiceError(
            `recurrence_type '${effectiveType}' does not match recurrence_rule type '${parsedRule.type}'`,
            400
          );
        }
      } else if (input.recurrence_type !== undefined && input.recurrence_rule === undefined) {
        // Changing type without updating rule -- check existing rule
        if (existing.recurrence_rule) {
          const parsedExisting = parseRule(existing.recurrence_rule);
          if (input.recurrence_type !== parsedExisting.type) {
            throw new ServiceError(
              `recurrence_type '${input.recurrence_type}' does not match existing recurrence_rule type '${parsedExisting.type}'. Update recurrence_rule as well.`,
              400
            );
          }
        }
      }

      // Validate next_due if provided (and not null — null clears it)
      if (input.next_due !== undefined && input.next_due !== null) {
        if (!isValidDateString(input.next_due)) {
          throw new ServiceError("next_due must be a valid ISO date (YYYY-MM-DD)", 400);
        }
      }
    }

    const schedules = this.scheduleRepo.updateMany(inputs);
    for (const s of schedules) {
      const fields = Object.keys(inputs.find((i) => i.id === s.id) ?? {}).filter(
        (k) => k !== "id"
      );
      this.activityLog.insert({
        entity_type: "schedule",
        entity_id: s.id,
        action: "updated",
        summary: JSON.stringify({ fields }),
      });
    }
    this.eventBus.emit({
      type: "updated",
      entity_type: "schedule",
      payload: schedules,
    });
    return schedules;
  }

  remove(ids: string[]): number {
    const deleted = this.scheduleRepo.deleteMany(ids);
    for (const id of ids) {
      this.activityLog.insert({
        entity_type: "schedule",
        entity_id: id,
        action: "deleted",
        summary: JSON.stringify({}),
      });
    }
    this.eventBus.emit({ type: "deleted", entity_type: "schedule", ids });
    return deleted;
  }

  advance(id: string): Schedule {
    const schedule = this.scheduleRepo.findById(id);
    if (!schedule) throw new ServiceError("schedule not found", 404);

    const today = formatDate(new Date());
    let newNextDue: string | null = null;

    if (schedule.recurrence_type === "once") {
      // One-off schedule is exhausted after completion
      newNextDue = null;
    } else if (schedule.recurrence_rule) {
      // Compute next due from the previous next_due (not from today).
      // This ensures overdue tasks advance correctly from their last
      // scheduled date rather than from the current wall-clock time.
      const rule = parseRule(schedule.recurrence_rule);
      const refDate = schedule.next_due ? parseDate(schedule.next_due) : new Date();
      const nd = nextDue(rule, refDate);
      newNextDue = nd ? formatDate(nd) : null;
    }

    const [updated] = this.scheduleRepo.updateMany([
      {
        id: schedule.id,
        last_completed: today,
        next_due: newNextDue,
      },
    ]);

    this.activityLog.insert({
      entity_type: "schedule",
      entity_id: schedule.id,
      action: "completed",
      summary: JSON.stringify({
        task_id: schedule.task_id,
        last_completed: today,
        next_due: newNextDue,
      }),
    });

    this.eventBus.emit({
      type: "updated",
      entity_type: "schedule",
      payload: [updated],
    });

    return updated;
  }
}
