import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/render-helpers";
import { TaskDetailPage } from "./TaskDetailPage";
import type { HomeTask, Note, ScheduleSummary, ActivityLog, Schedule } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", () => ({
  useTask: vi.fn(),
}));

vi.mock("../api", () => ({
  updateTasks: vi.fn(),
  completeTask: vi.fn(),
  createNotes: vi.fn(),
  createSchedules: vi.fn(),
  updateSchedules: vi.fn(),
  deleteSchedules: vi.fn(),
  fetchSchedule: vi.fn(),
}));

import { useTask } from "../hooks";
import { updateTasks, completeTask, createNotes, createSchedules, updateSchedules, deleteSchedules, fetchSchedule } from "../api";

const mockUseTask = vi.mocked(useTask);
const mockUpdateTasks = vi.mocked(updateTasks);
const mockCompleteTask = vi.mocked(completeTask);
const mockCreateNotes = vi.mocked(createNotes);
const mockCreateSchedules = vi.mocked(createSchedules);
const mockUpdateSchedules = vi.mocked(updateSchedules);
const mockDeleteSchedules = vi.mocked(deleteSchedules);
const mockFetchSchedule = vi.mocked(fetchSchedule);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2026-04-03T12:00:00.000Z";

function makeTask(overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    id: "task-1",
    title: "Test Task",
    description: "Task description",
    status: "active",
    area: "kitchen",
    effort: "medium",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<ScheduleSummary> = {}): ScheduleSummary {
  return {
    id: "sched-1",
    task_id: "task-1",
    recurrence_type: "weekly",
    next_due: "2026-04-10",
    last_completed: "2026-04-03",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    task_id: "task-1",
    title: "Test Note",
    content: "Some note content",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "act-1",
    entity_type: "home_task",
    entity_id: "task-1",
    action: "completed",
    summary: '{"next_due":"2026-04-10","last_completed":"2026-04-03"}',
    created_at: NOW,
    ...overrides,
  };
}

function setupHook(overrides: Partial<ReturnType<typeof useTask>> = {}) {
  mockUseTask.mockReturnValue({
    task: makeTask(),
    schedules: [makeSchedule()],
    notes: [makeNote()],
    completionHistory: [makeActivity()],
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

const defaultProps = {
  taskId: "task-1",
  onBack: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TaskDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  describe("data loading", () => {
    it("shows loading message when loading=true and task=null", () => {
      setupHook({ loading: true, task: null });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText("Loading task...")).toBeInTheDocument();
    });

    it("shows error message when error is set and task=null", () => {
      setupHook({ error: "Task not found", task: null });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText("Task not found")).toBeInTheDocument();
    });

    it("renders task details when data is loaded", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Inline editing
  // -------------------------------------------------------------------------

  describe("inline editing", () => {
    it("title input shows current task title", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });

    it("Save Changes button is hidden when no edits are made", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
    });

    it("changing title enables Save Changes button", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.change(screen.getByDisplayValue("Test Task"), {
        target: { value: "Updated Title" },
      });

      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("changing description enables Save Changes button", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      const textarea = screen.getByDisplayValue("Task description");
      fireEvent.change(textarea, { target: { value: "New description" } });

      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("changing status dropdown enables Save Changes button", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      // First select is status
      fireEvent.change(selects[0], { target: { value: "paused" } });

      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("save calls updateTasks with only changed fields", async () => {
      mockUpdateTasks.mockResolvedValue([makeTask({ title: "Updated Title" })]);
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.change(screen.getByDisplayValue("Test Task"), {
        target: { value: "Updated Title" },
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(mockUpdateTasks).toHaveBeenCalledWith([
          expect.objectContaining({ id: "task-1", title: "Updated Title" }),
        ]);
      });

      // Verify it did not include unchanged fields
      const callArg = mockUpdateTasks.mock.calls[0][0][0];
      expect(callArg).not.toHaveProperty("status");
      expect(callArg).not.toHaveProperty("area");
    });

    it("save resets edit state on success", async () => {
      mockUpdateTasks.mockResolvedValue([makeTask({ title: "Updated Title" })]);
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.change(screen.getByDisplayValue("Test Task"), {
        target: { value: "Updated Title" },
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
      });
    });

    it("StatusDot reflects the currently edited status value", () => {
      setupHook({ task: makeTask({ status: "active" }) });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      // Change status to paused
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "paused" } });

      // StatusDot should now have title="paused"
      const dot = document.querySelector("[title='paused']");
      expect(dot).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Completion flow
  // -------------------------------------------------------------------------

  describe("completion flow", () => {
    it("Mark Done button calls completeTask with task ID", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeTask({ status: "done" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Mark Done"));

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith("task-1", undefined);
      });
    });

    it("busy state disables Mark Done button", async () => {
      mockCompleteTask.mockReturnValue(new Promise(() => {}));
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      const markDoneBtn = screen.getByText("Mark Done").closest("button")!;
      fireEvent.click(markDoneBtn);

      await waitFor(() => {
        // Button atom shows a loading spinner and becomes disabled
        expect(markDoneBtn).toBeDisabled();
      });
    });

    it("'+ note' link shows completion note textarea", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      expect(screen.queryByPlaceholderText("Completion note...")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("+ note"));

      expect(screen.getByPlaceholderText("Completion note...")).toBeInTheDocument();
    });

    it("completion note text is sent with completeTask call", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeTask({ status: "done" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ note"));
      fireEvent.change(screen.getByPlaceholderText("Completion note..."), {
        target: { value: "Done with note" },
      });
      fireEvent.click(screen.getByText("Mark Done"));

      await waitFor(() => {
        expect(mockCompleteTask).toHaveBeenCalledWith("task-1", "Done with note");
      });
    });

    it("refetch is called after successful completion", async () => {
      mockCompleteTask.mockResolvedValue({
        task: makeTask({ status: "done" }),
        schedule: null,
        next_due: null,
        completed_at: NOW,
        note_created: null,
      });
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Mark Done"));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // ScheduleSection
  // -------------------------------------------------------------------------

  describe("ScheduleSection", () => {
    it("shows schedule card when schedule exists", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      expect(screen.getByText("weekly")).toBeInTheDocument();
      expect(screen.getByText(/Next due: 2026-04-10/)).toBeInTheDocument();
      expect(screen.getByText(/Last completed: 2026-04-03/)).toBeInTheDocument();
    });

    it("shows '+ Add schedule' link when no schedule exists", () => {
      setupHook({ schedules: [] });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText("+ Add schedule")).toBeInTheDocument();
    });

    it("clicking '+ Add schedule' opens ScheduleOverlay in create mode", () => {
      setupHook({ schedules: [] });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ Add schedule"));
      expect(screen.getByText("Create Schedule")).toBeInTheDocument();
    });

    it("clicking Edit opens ScheduleOverlay in edit mode", () => {
      mockFetchSchedule.mockResolvedValue({
        id: "sched-1",
        task_id: "task-1",
        recurrence_type: "weekly",
        recurrence_rule: null,
        next_due: "2026-04-10",
        last_completed: "2026-04-03",
        created_at: NOW,
        updated_at: NOW,
      });
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Edit"));
      expect(screen.getByText("Edit Schedule")).toBeInTheDocument();
    });

    it("ScheduleOverlay submit calls createSchedules in create mode", async () => {
      mockCreateSchedules.mockResolvedValue([]);
      setupHook({ schedules: [] });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ Add schedule"));

      // Fill in next due using the date input (type="date")
      const dateInput = document.querySelector("input[type='date']") as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2026-05-01" } });

      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockCreateSchedules).toHaveBeenCalledWith([
          expect.objectContaining({
            task_id: "task-1",
            recurrence_type: "weekly",
          }),
        ]);
      });
    });

    it("delete button calls deleteSchedules and triggers refetch", async () => {
      mockDeleteSchedules.mockResolvedValue(undefined);
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Remove"));

      await waitFor(() => {
        expect(mockDeleteSchedules).toHaveBeenCalledWith(["sched-1"]);
      });

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // NotesSection
  // -------------------------------------------------------------------------

  describe("NotesSection", () => {
    it("shows note cards with title", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText("Test Note")).toBeInTheDocument();
    });

    it("shows note count in section header", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText("Notes (1)")).toBeInTheDocument();
    });

    it("'+ Add note' link shows inline form", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ Add note"));

      expect(screen.getByPlaceholderText("Note title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Content (optional)")).toBeInTheDocument();
    });

    it("submitting note form calls createNotes with title, content, and task_id", async () => {
      mockCreateNotes.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ Add note"));

      fireEvent.change(screen.getByPlaceholderText("Note title"), {
        target: { value: "New Note" },
      });
      fireEvent.change(screen.getByPlaceholderText("Content (optional)"), {
        target: { value: "Note content" },
      });

      fireEvent.click(screen.getByText("Add Note"));

      await waitFor(() => {
        expect(mockCreateNotes).toHaveBeenCalledWith([{
          title: "New Note",
          content: "Note content",
          task_id: "task-1",
        }]);
      });
    });

    it("cancel button hides the add note form", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ Add note"));
      expect(screen.getByPlaceholderText("Note title")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByPlaceholderText("Note title")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CompletionHistory
  // -------------------------------------------------------------------------

  describe("CompletionHistory", () => {
    it("renders completion history entries", () => {
      setupHook();
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.getByText(/Completion History/)).toBeInTheDocument();
    });

    it("does not render section when history is empty", () => {
      setupHook({ completionHistory: [] });
      renderWithProviders(<TaskDetailPage {...defaultProps} />);
      expect(screen.queryByText(/Completion History/)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Back navigation
  // -------------------------------------------------------------------------

  describe("back navigation", () => {
    it("back button calls onBack prop", () => {
      const onBack = vi.fn();
      setupHook();
      renderWithProviders(<TaskDetailPage taskId="task-1" onBack={onBack} />);

      fireEvent.click(screen.getByText(/Back to Tasks/));
      expect(onBack).toHaveBeenCalled();
    });
  });
});
