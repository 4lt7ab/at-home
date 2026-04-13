import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeReminderSummary } from "../test/render-helpers";
import { ReminderDashboardPage } from "./ReminderDashboardPage";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetchOverdue = vi.fn();
const mockRefetchThisWeek = vi.fn();
const mockRefetchNextWeek = vi.fn();
const mockRefetchDormant = vi.fn();

vi.mock("../hooks", () => ({
  useReminders: vi.fn(),
}));

vi.mock("../api", () => ({
  createReminders: vi.fn(),
  dismissReminders: vi.fn(),
  updateReminders: vi.fn(),
}));

import { useReminders } from "../hooks";
import { createReminders, dismissReminders, updateReminders } from "../api";

const mockUseReminders = vi.mocked(useReminders);
const mockCreateReminders = vi.mocked(createReminders);
const mockDismissReminders = vi.mocked(dismissReminders);
const mockUpdateReminders = vi.mocked(updateReminders);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RemindersReturn = ReturnType<typeof useReminders>;

function defaultReturn(refetch: ReturnType<typeof vi.fn>): RemindersReturn {
  return {
    reminders: [],
    total: 0,
    loading: false,
    error: null,
    refetch,
  };
}

/**
 * The component calls useReminders four times with different params:
 *   1. overdue (status: "active", remind_at_to only — no remind_at_from)
 *   2. thisWeek (status: "active", this week bounds)
 *   3. nextWeek (status: "active", next week bounds)
 *   4. dormant (status: "dormant")
 * We match on the status param to identify dormant vs active calls,
 * and use remind_at_from presence/value to distinguish overdue/this/next week.
 */
function setupHook(overrides?: {
  overdue?: Partial<RemindersReturn>;
  thisWeek?: Partial<RemindersReturn>;
  nextWeek?: Partial<RemindersReturn>;
  dormant?: Partial<RemindersReturn>;
}) {
  const now = new Date();
  const day = now.getUTCDay();
  const thisSunday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day,
  ));
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 7,
  ));
  const thisWeekStart = thisSunday.toISOString();
  const nextWeekStart = nextSunday.toISOString();

  mockUseReminders.mockImplementation((params) => {
    if (params?.status === "dormant") {
      return { ...defaultReturn(mockRefetchDormant), ...overrides?.dormant };
    }
    // Overdue: active with no remind_at_from (only remind_at_to)
    if (params?.status === "active" && !params?.remind_at_from) {
      return { ...defaultReturn(mockRefetchOverdue), ...overrides?.overdue };
    }
    if (params?.remind_at_from === nextWeekStart) {
      return { ...defaultReturn(mockRefetchNextWeek), ...overrides?.nextWeek };
    }
    return { ...defaultReturn(mockRefetchThisWeek), ...overrides?.thisWeek };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReminderDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders page title 'Reminders'", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);
      expect(screen.getByText("Reminders")).toBeInTheDocument();
    });

    it("renders This Week and Next Week section headings", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);
      expect(screen.getByText("This Week")).toBeInTheDocument();
      expect(screen.getByText("Next Week")).toBeInTheDocument();
    });

    it("renders Overdue section when overdue reminders exist", () => {
      const overdue = [
        makeReminderSummary({ id: "o1", context_preview: "Overdue task" }),
      ];
      setupHook({ overdue: { reminders: overdue, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);
      expect(screen.getByText("Overdue")).toBeInTheDocument();
      expect(screen.getByText("Overdue task")).toBeInTheDocument();
    });

    it("hides Overdue section when no overdue reminders", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);
      expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    });

    it("renders reminder cards with correct content", () => {
      const reminders = [
        makeReminderSummary({ id: "r1", context_preview: "Buy groceries" }),
        makeReminderSummary({ id: "r2", context_preview: "Call dentist" }),
      ];
      setupHook({ thisWeek: { reminders, total: 2 } });
      renderWithProviders(<ReminderDashboardPage />);

      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
      expect(screen.getByText("Call dentist")).toBeInTheDocument();
    });

    it("shows recurrence badge when recurrence is set", () => {
      const reminders = [
        makeReminderSummary({ id: "r1", context_preview: "Weekly standup", recurrence: "weekly" }),
      ];
      setupHook({ thisWeek: { reminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      expect(screen.getByText("weekly")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows empty state messages when no reminders", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);
      expect(screen.getByText("No reminders this week.")).toBeInTheDocument();
      expect(screen.getByText("No reminders next week.")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows skeletons when loading=true and reminders is empty", () => {
      setupHook({
        thisWeek: { loading: true, reminders: [] },
        nextWeek: { loading: true, reminders: [] },
      });
      renderWithProviders(<ReminderDashboardPage />);
      // Skeletons render, no empty state visible
      expect(screen.queryByText("No reminders this week.")).not.toBeInTheDocument();
      expect(screen.queryByText("No reminders next week.")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CreateReminderOverlay
  // -------------------------------------------------------------------------

  describe("CreateReminderOverlay", () => {
    it("opens on '+ New Reminder' button click", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("+ New Reminder"));
      expect(screen.getByText("New Reminder")).toBeInTheDocument();
    });

    it("does not submit when required fields are empty", async () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("+ New Reminder"));
      fireEvent.click(screen.getByText("Create"));

      // createReminders should not be called since fields are empty
      expect(mockCreateReminders).not.toHaveBeenCalled();
    });

    it("submits with context, remind_at, and recurrence", async () => {
      mockCreateReminders.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("+ New Reminder"));

      fireEvent.change(screen.getByPlaceholderText("What do you want to be reminded about?"), {
        target: { value: "Water the plants" },
      });

      // Set datetime-local input
      const datetimeInput = screen.getByDisplayValue("");
      fireEvent.change(datetimeInput, {
        target: { value: "2026-04-15T10:00" },
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreateReminders).toHaveBeenCalledWith([{
          context: "Water the plants",
          remind_at: expect.any(String),
          recurrence: undefined,
        }]);
      });
    });

    it("closes on Cancel button click", () => {
      setupHook();
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("+ New Reminder"));
      expect(screen.getByText("New Reminder")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("What do you want to be reminded about?")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Dismiss
  // -------------------------------------------------------------------------

  describe("dismiss", () => {
    it("dismiss button calls dismissReminders with correct id", async () => {
      mockDismissReminders.mockResolvedValue([]);
      const reminders = [
        makeReminderSummary({ id: "r1", context_preview: "Do laundry" }),
      ];
      setupHook({ thisWeek: { reminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("Dismiss"));

      await waitFor(() => {
        expect(mockDismissReminders).toHaveBeenCalledWith([{ id: "r1" }]);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dormant section
  // -------------------------------------------------------------------------

  describe("dormant section", () => {
    it("renders dormant reminders when expanded", () => {
      const dormantReminders = [
        makeReminderSummary({ id: "d1", context_preview: "Old reminder", is_active: false }),
      ];
      setupHook({ dormant: { reminders: dormantReminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      // Click to expand dormant section
      fireEvent.click(screen.getByText("Dormant Reminders"));

      expect(screen.getByText("Old reminder")).toBeInTheDocument();
      expect(screen.getByText("Reactivate")).toBeInTheDocument();
    });

    it("reactivate flow opens modal and submits new remind_at", async () => {
      mockUpdateReminders.mockResolvedValue([]);
      const dormantReminders = [
        makeReminderSummary({ id: "d1", context_preview: "Reactivate me" }),
      ];
      setupHook({ dormant: { reminders: dormantReminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      // Expand dormant section
      fireEvent.click(screen.getByText("Dormant Reminders"));

      // Click reactivate
      fireEvent.click(screen.getByText("Reactivate"));

      // Modal should appear with title and context preview
      expect(screen.getByText("Reactivate Reminder")).toBeInTheDocument();
      // "Reactivate me" appears both in the card and modal preview
      expect(screen.getAllByText("Reactivate me").length).toBeGreaterThanOrEqual(2);

      // Set new datetime
      const datetimeInput = screen.getByDisplayValue("");
      fireEvent.change(datetimeInput, {
        target: { value: "2026-04-20T14:00" },
      });

      fireEvent.click(screen.getByText("Set"));

      await waitFor(() => {
        expect(mockUpdateReminders).toHaveBeenCalledWith([{
          id: "d1",
          remind_at: expect.any(String),
        }]);
      });
    });
  });
});
