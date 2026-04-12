import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "@4lt7ab/ui/core";
import { EventSubscriptionContext } from "../hooks/useEventSubscription";
import type { EventSubscriptionContextValue } from "../hooks/useEventSubscription";
import type { HomeTaskSummary, NoteSummary, ScheduleSummary } from "@domain/entities";
import type { DailySummary, DailySummaryItem } from "@domain/summary";

// ---------------------------------------------------------------------------
// Default mock context values
// ---------------------------------------------------------------------------

const defaultEventContext: EventSubscriptionContextValue = {
  subscribeEvents: () => () => {},
  connected: true,
};

// ---------------------------------------------------------------------------
// renderWithProviders
// ---------------------------------------------------------------------------

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  eventContext?: Partial<EventSubscriptionContextValue>;
}

/**
 * Renders a component wrapped in ThemeProvider and EventSubscriptionContext
 * providers with sensible defaults. Override context values via options.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions = {},
) {
  const {
    eventContext = {},
    ...renderOptions
  } = options;

  const events = { ...defaultEventContext, ...eventContext };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider defaultTheme="synthwave">
        <EventSubscriptionContext.Provider value={events}>
          {children}
        </EventSubscriptionContext.Provider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let _factoryCounter = 0;
function nextId(): string {
  _factoryCounter++;
  return `test-${String(_factoryCounter).padStart(6, "0")}`;
}

const NOW = "2026-04-03T12:00:00.000Z";

export function makeHomeTaskSummary(
  overrides: Partial<HomeTaskSummary> = {},
): HomeTaskSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    title: `Task ${id}`,
    status: "active",
    area: null,
    effort: null,
    has_description: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeNoteSummary(
  overrides: Partial<NoteSummary> = {},
): NoteSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    task_id: null,
    title: `Note ${id}`,
    has_content: false,
    note_type: "manual" as const,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeScheduleSummary(
  overrides: Partial<ScheduleSummary> = {},
): ScheduleSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    task_id: overrides.task_id ?? nextId(),
    recurrence_type: "daily",
    next_due: "2026-04-03",
    last_completed: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeDailySummary(
  overrides: Partial<DailySummary> = {},
): DailySummary {
  return {
    date: "2026-04-03",
    overdue: [],
    due_today: [],
    upcoming: [],
    counts: { overdue: 0, due_today: 0, upcoming: 0, total: 0 },
    ...overrides,
  };
}

export function makeDailySummaryItem(
  overrides: Partial<DailySummaryItem> = {},
): DailySummaryItem {
  const task = overrides.task ?? makeHomeTaskSummary();
  const schedule = overrides.schedule ?? makeScheduleSummary({ task_id: task.id });
  return {
    task,
    schedule,
    notes: [],
    days_overdue: 0,
    recurrence_label: "Daily",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Re-exports from testing libraries
// ---------------------------------------------------------------------------

export { render, screen, fireEvent, waitFor, act, renderHook, userEvent };
