import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeDailySummary, makeDailySummaryItem, makeHomeTaskSummary, makeNoteSummary, makeScheduleSummary } from "../test/render-helpers";
import { DailySummaryPage } from "./DailySummaryPage";
import type { DailySummary } from "@domain/summary";
import type { HomeTask, Note, ActivityLog } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", () => ({
  useDailySummary: vi.fn(),
}));

vi.mock("../api", () => ({
  completeTask: vi.fn(),
  fetchTask: vi.fn(),
  fetchSchedules: vi.fn(),
  fetchNotes: vi.fn(),
  fetchNote: vi.fn(),
  fetchActivityLog: vi.fn(),
}));

import { useDailySummary } from "../hooks";
import { completeTask, fetchTask, fetchSchedules, fetchNotes, fetchNote, fetchActivityLog } from "../api";

const mockUseDailySummary = vi.mocked(useDailySummary);
const mockCompleteTask = vi.mocked(completeTask);
const mockFetchTask = vi.mocked(fetchTask);
const mockFetchSchedules = vi.mocked(fetchSchedules);
const mockFetchNotes = vi.mocked(fetchNotes);
const mockFetchNote = vi.mocked(fetchNote);
const mockFetchActivityLog = vi.mocked(fetchActivityLog);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function setupHook(overrides: Partial<ReturnType<typeof useDailySummary>> = {}) {
  mockUseDailySummary.mockReturnValue({
    summary: null,
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

function makeFullTask(overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    id: "task-1",
    title: "Full Task",
    description: "A full task description",
    status: "active",
    area: "kitchen",
    effort: "medium",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DailySummaryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows loading message when summary is null and loading is true", () => {
      setupHook({ loading: true, summary: null });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Loading today's summary...")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe("error state", () => {
    it("shows error message when error is set and summary is null", () => {
      setupHook({ error: "Something went wrong", summary: null });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows 'All clear' when counts.total is 0", () => {
      setupHook({ summary: makeDailySummary() });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText(/All clear/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Section rendering
  // -------------------------------------------------------------------------

  describe("section rendering", () => {
    it("renders Overdue section when overdue items exist", () => {
      const item = makeDailySummaryItem({ days_overdue: 3 });
      const summary = makeDailySummary({
        overdue: [item],
        counts: { overdue: 1, due_today: 0, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Overdue (1)")).toBeInTheDocument();
    });

    it("renders Due Today section when due_today items exist", () => {
      const item = makeDailySummaryItem();
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Due Today (1)")).toBeInTheDocument();
    });

    it("renders Upcoming section when upcoming items exist", () => {
      const item = makeDailySummaryItem();
      const summary = makeDailySummary({
        upcoming: [item],
        counts: { overdue: 0, due_today: 0, upcoming: 1, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Upcoming (1)")).toBeInTheDocument();
    });

    it("does not render sections with zero items", () => {
      const item = makeDailySummaryItem();
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Upcoming/)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // SummaryItem rendering
  // -------------------------------------------------------------------------

  describe("SummaryItem rendering", () => {
    it("shows task title", () => {
      const item = makeDailySummaryItem({
        task: makeHomeTaskSummary({ title: "Clean the kitchen" }),
      });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Clean the kitchen")).toBeInTheDocument();
    });

    it("shows area badge when task has area", () => {
      const item = makeDailySummaryItem({
        task: makeHomeTaskSummary({ area: "living_room" }),
      });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("living room")).toBeInTheDocument();
    });

    it("shows recurrence label badge", () => {
      const item = makeDailySummaryItem({ recurrence_label: "Weekly" });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Weekly")).toBeInTheDocument();
    });

    it("shows overdue badge with days count for danger variant (overdue) items", () => {
      const item = makeDailySummaryItem({ days_overdue: 5 });
      const summary = makeDailySummary({
        overdue: [item],
        counts: { overdue: 1, due_today: 0, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("5d overdue")).toBeInTheDocument();
    });

    it("does not show overdue badge for due_today (primary variant) items", () => {
      const item = makeDailySummaryItem({ days_overdue: 0 });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    });

    it("shows due date for upcoming (muted variant) items", () => {
      const item = makeDailySummaryItem({
        schedule: makeScheduleSummary({ next_due: "2026-04-10" }),
      });
      const summary = makeDailySummary({
        upcoming: [item],
        counts: { overdue: 0, due_today: 0, upcoming: 1, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("Due: 2026-04-10")).toBeInTheDocument();
    });

    it("shows notes count link when item has notes", () => {
      const item = makeDailySummaryItem({
        notes: [makeNoteSummary({ title: "My note" })],
      });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);
      expect(screen.getByText("1 note")).toBeInTheDocument();
    });

    it("clicking notes link toggles note titles display", () => {
      const item = makeDailySummaryItem({
        notes: [makeNoteSummary({ title: "My note title" })],
      });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      renderWithProviders(<DailySummaryPage />);

      // Note title not shown initially
      expect(screen.queryByText("My note title")).not.toBeInTheDocument();

      // Click notes link
      fireEvent.click(screen.getByText("1 note"));

      // Note title now visible
      expect(screen.getByText("My note title")).toBeInTheDocument();

      // Click again to hide
      fireEvent.click(screen.getByText("hide"));
      expect(screen.queryByText("My note title")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // MarkDoneButton
  // -------------------------------------------------------------------------

  describe("MarkDoneButton", () => {
    function renderWithItem() {
      const task = makeHomeTaskSummary({ id: "task-42", title: "Do the thing" });
      const item = makeDailySummaryItem({ task });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });
      return renderWithProviders(<DailySummaryPage />);
    }

    it("click calls completeTask API with task ID", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeFullTask({ id: "task-42" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      renderWithItem();

      fireEvent.click(screen.getByText("Done"));

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith("task-42", undefined);
      });
    });

    it("shows '...' text and disabled state while busy", async () => {
      mockCompleteTask.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithItem();

      fireEvent.click(screen.getByText("Done"));

      await waitFor(() => {
        expect(screen.getByText("...")).toBeInTheDocument();
      });
      expect(screen.getByText("...").closest("button")).toBeDisabled();
    });

    it("'+ note' link toggles textarea visibility", () => {
      renderWithItem();

      expect(screen.queryByPlaceholderText("Completion note...")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("+ note"));

      expect(screen.getByPlaceholderText("Completion note...")).toBeInTheDocument();
    });

    it("sends completion note text when textarea has content", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeFullTask({ id: "task-42" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      renderWithItem();

      // Show textarea and type a note
      fireEvent.click(screen.getByText("+ note"));
      fireEvent.change(screen.getByPlaceholderText("Completion note..."), {
        target: { value: "My completion note" },
      });

      // Click Done
      fireEvent.click(screen.getByText("Done"));

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith("task-42", "My completion note");
      });
    });

    it("calls refetch after successful completion", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeFullTask({ id: "task-42" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      renderWithItem();

      fireEvent.click(screen.getByText("Done"));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // TaskDetailOverlay
  // -------------------------------------------------------------------------

  describe("TaskDetailOverlay", () => {
    function renderAndOpenOverlay() {
      const task = makeHomeTaskSummary({ id: "task-99", title: "Overlay Task" });
      const item = makeDailySummaryItem({ task });
      const summary = makeDailySummary({
        due_today: [item],
        counts: { overdue: 0, due_today: 1, upcoming: 0, total: 1 },
      });
      setupHook({ summary });

      // Set up overlay fetch mocks
      mockFetchTask.mockResolvedValue(makeFullTask({
        id: "task-99",
        title: "Overlay Task Full",
        description: "Detailed description",
        area: "kitchen",
        effort: "high",
      }));
      mockFetchSchedules.mockResolvedValue({
        data: [{
          id: "sched-1", task_id: "task-99", recurrence_type: "weekly",
          next_due: "2026-04-10", last_completed: "2026-04-03",
          created_at: NOW, updated_at: NOW,
        }],
        total: 1,
      });
      mockFetchNotes.mockResolvedValue({
        data: [{ id: "note-1", task_id: "task-99", title: "Test Note", has_content: true, created_at: NOW, updated_at: NOW }],
        total: 1,
      });
      mockFetchNote.mockResolvedValue({
        id: "note-1", task_id: "task-99", title: "Test Note",
        content: "Note content here", created_at: NOW, updated_at: NOW,
      });
      mockFetchActivityLog.mockResolvedValue({
        data: [
          { id: "act-1", entity_type: "home_task" as const, entity_id: "task-99", action: "completed" as const, summary: '{"next_due":"2026-04-10","last_completed":"2026-04-03"}', created_at: NOW },
        ],
        total: 1,
      });

      renderWithProviders(<DailySummaryPage />);

      // Click the item to open overlay (click on the title area)
      const titleEl = screen.getByText("Overlay Task");
      fireEvent.click(titleEl);
    }

    it("opens when a SummaryItem is clicked", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText("Loading task details...")).toBeInTheDocument();
      });
    });

    it("shows task details after loading", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText("Overlay Task Full")).toBeInTheDocument();
      });

      expect(screen.getByText("Detailed description")).toBeInTheDocument();
      expect(screen.getByText("kitchen")).toBeInTheDocument();
      expect(screen.getByText("high")).toBeInTheDocument();
    });

    it("displays schedule info", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText("weekly")).toBeInTheDocument();
      });

      expect(screen.getByText(/Next due: 2026-04-10/)).toBeInTheDocument();
      expect(screen.getByText(/Last completed: 2026-04-03/)).toBeInTheDocument();
    });

    it("displays notes with content", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText(/Notes/)).toBeInTheDocument();
      });

      expect(screen.getByText("Test Note")).toBeInTheDocument();
      expect(screen.getByText("Note content here")).toBeInTheDocument();
    });

    it("displays completion history entries", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText(/Completion History/)).toBeInTheDocument();
      });
    });

    it("closes on X button click", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText("Overlay Task Full")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Close"));

      await waitFor(() => {
        expect(screen.queryByText("Overlay Task Full")).not.toBeInTheDocument();
      });
    });

    it("closes on Escape key press", async () => {
      renderAndOpenOverlay();

      await waitFor(() => {
        expect(screen.getByText("Overlay Task Full")).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Overlay Task Full")).not.toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Date header
  // -------------------------------------------------------------------------

  describe("date header", () => {
    it("displays current date", () => {
      setupHook({ summary: makeDailySummary() });
      renderWithProviders(<DailySummaryPage />);
      // The date header uses toLocaleDateString which depends on locale,
      // so just verify a date-like string is rendered
      const dateEl = document.querySelector("[style*='text-align: center']");
      expect(dateEl).toBeTruthy();
    });
  });
});
