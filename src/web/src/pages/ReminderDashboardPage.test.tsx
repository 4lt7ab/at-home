import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeReminderSummary } from "../test/render-helpers";
import { ReminderDashboardPage } from "./ReminderDashboardPage";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetchOverdue = vi.fn();
const mockRefetchToday = vi.fn();
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
  deleteReminders: vi.fn(),
}));

import { useReminders } from "../hooks";
import { createReminders, dismissReminders, updateReminders, deleteReminders } from "../api";

const mockUseReminders = vi.mocked(useReminders);
const mockCreateReminders = vi.mocked(createReminders);
const mockDismissReminders = vi.mocked(dismissReminders);
const mockUpdateReminders = vi.mocked(updateReminders);
const mockDeleteReminders = vi.mocked(deleteReminders);

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
 * The component calls useReminders five times with different params:
 *   1. overdue (status: "active", remind_at_to = today start, no remind_at_from)
 *   2. today (status: "active", remind_at_from = today start, remind_at_to = today end)
 *   3. thisWeek (status: "active", remind_at_from = tomorrow, remind_at_to = week end)
 *   4. nextWeek (status: "active", next week bounds)
 *   5. dormant (status: "dormant")
 * We use a call counter to map them in order.
 */
function setupHook(overrides?: {
  overdue?: Partial<RemindersReturn>;
  today?: Partial<RemindersReturn>;
  thisWeek?: Partial<RemindersReturn>;
  nextWeek?: Partial<RemindersReturn>;
  dormant?: Partial<RemindersReturn>;
}) {
  let callIndex = 0;
  const order: Array<{ refetch: ReturnType<typeof vi.fn>; data?: Partial<RemindersReturn> }> = [
    { refetch: mockRefetchOverdue, data: overrides?.overdue },
    { refetch: mockRefetchToday, data: overrides?.today },
    { refetch: mockRefetchThisWeek, data: overrides?.thisWeek },
    { refetch: mockRefetchNextWeek, data: overrides?.nextWeek },
    { refetch: mockRefetchDormant, data: overrides?.dormant },
  ];

  mockUseReminders.mockImplementation(() => {
    const entry = order[callIndex % order.length];
    callIndex++;
    return { ...defaultReturn(entry.refetch), ...entry.data };
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

      // Set date input
      const dateInput = screen.getByDisplayValue("");
      fireEvent.change(dateInput, {
        target: { value: "2026-04-15" },
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
  // Edit modal (click card)
  // -------------------------------------------------------------------------

  describe("edit modal", () => {
    it("clicking a reminder card opens edit modal", () => {
      const reminders = [
        makeReminderSummary({ id: "r1", context_preview: "Do laundry" }),
      ];
      setupHook({ thisWeek: { reminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("Do laundry"));

      expect(screen.getByText("Edit Reminder")).toBeInTheDocument();
    });

    it("edit modal shows dismiss and delete buttons for active reminders", () => {
      const reminders = [
        makeReminderSummary({ id: "r1", context_preview: "Active one" }),
      ];
      setupHook({ thisWeek: { reminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("Active one"));

      expect(screen.getByText("Dismiss")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("edit modal shows dormant banner for dormant reminders", () => {
      const dormantReminders = [
        makeReminderSummary({ id: "d1", context_preview: "Old reminder", is_active: false }),
      ];
      setupHook({ dormant: { reminders: dormantReminders, total: 1 } });
      renderWithProviders(<ReminderDashboardPage />);

      fireEvent.click(screen.getByText("Dormant Reminders"));
      fireEvent.click(screen.getByText("Old reminder"));

      expect(screen.getByText("Dormant Reminder")).toBeInTheDocument();
      expect(screen.getByText(/Set a future date and save to reactivate/)).toBeInTheDocument();
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

      fireEvent.click(screen.getByText("Dormant Reminders"));

      expect(screen.getByText("Old reminder")).toBeInTheDocument();
    });
  });
});
