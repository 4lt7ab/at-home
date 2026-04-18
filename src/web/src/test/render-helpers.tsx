import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "@4lt7ab/ui/core";
import { EventSubscriptionContext } from "../hooks/useEventSubscription";
import type { EventSubscriptionContextValue } from "../hooks/useEventSubscription";
import type { NoteSummary, ReminderSummary, LogSummary, LogEntrySummary } from "@domain/entities";

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

export function makeNoteSummary(
  overrides: Partial<NoteSummary> = {},
): NoteSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    title: `Note ${id}`,
    has_context: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

const TOMORROW = "2026-04-04T09:00:00.000Z";

export function makeReminderSummary(
  overrides: Partial<ReminderSummary> = {},
): ReminderSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    context: "Test reminder",
    context_preview: "Test reminder",
    remind_at: TOMORROW,
    recurrence: null,
    dismissed_at: null,
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeLogSummary(overrides: Partial<LogSummary> = {}): LogSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    name: `Log ${id}`,
    description: null,
    last_logged_at: null,
    entry_count: 0,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function makeLogEntrySummary(overrides: Partial<LogEntrySummary> = {}): LogEntrySummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    log_id: "log-test",
    occurred_at: NOW,
    note: null,
    note_preview: null,
    has_metadata: false,
    reactions: [],
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Re-exports from testing libraries
// ---------------------------------------------------------------------------

export { render, screen, fireEvent, waitFor, act, renderHook, userEvent };
