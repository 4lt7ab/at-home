import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeHomeTaskSummary } from "../test/render-helpers";
import { TaskListPage } from "./TaskListPage";
import type { HomeTaskSummary } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", () => ({
  useTasks: vi.fn(),
}));

vi.mock("../api", () => ({
  createTasks: vi.fn(),
}));

import { useTasks } from "../hooks";
import { createTasks } from "../api";

const mockUseTasks = vi.mocked(useTasks);
const mockCreateTasks = vi.mocked(createTasks);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHook(overrides: Partial<ReturnType<typeof useTasks>> = {}) {
  mockUseTasks.mockReturnValue({
    tasks: [],
    total: 0,
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

const defaultProps = {
  onNavigate: vi.fn(),
  viewMode: "list" as const,
  onToggleViewMode: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TaskListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders page title 'Tasks'", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });

    it("renders task cards for each task in the list", () => {
      const tasks = [
        makeHomeTaskSummary({ id: "t1", title: "Task One" }),
        makeHomeTaskSummary({ id: "t2", title: "Task Two" }),
      ];
      setupHook({ tasks, total: 2 });
      renderWithProviders(<TaskListPage {...defaultProps} />);

      expect(screen.getByText("Task One")).toBeInTheDocument();
      expect(screen.getByText("Task Two")).toBeInTheDocument();
    });

    it("TaskCard shows area badge and effort badge", () => {
      const tasks = [
        makeHomeTaskSummary({ id: "t1", title: "Task With Badges", area: "garage", effort: "high" }),
      ];
      setupHook({ tasks, total: 1 });
      renderWithProviders(<TaskListPage {...defaultProps} />);

      // The card for this task should contain the area and effort badges
      const card = screen.getByText("Task With Badges").closest("[role='button']")!;
      expect(card.textContent).toContain("garage");
      expect(card.textContent).toContain("high");
    });
  });

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  describe("filters", () => {
    it("status dropdown defaults to 'active'", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      // First select is status
      expect(selects[0]).toHaveValue("active");
    });

    it("area dropdown defaults to empty (All areas)", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      // Second select is area
      expect(selects[1]).toHaveValue("");
    });

    it("changing status filter updates useTasks params", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "paused" } });

      // After re-render, useTasks should have been called with updated params
      const lastCall = mockUseTasks.mock.calls[mockUseTasks.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ status: "paused" });
    });

    it("changing area filter updates useTasks params", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[1], { target: { value: "kitchen" } });

      const lastCall = mockUseTasks.mock.calls[mockUseTasks.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ area: "kitchen" });
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows 'Loading tasks...' when loading=true and tasks is empty", () => {
      setupHook({ loading: true, tasks: [] });
      renderWithProviders(<TaskListPage {...defaultProps} />);
      expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows 'No tasks found' message when not loading and tasks is empty", () => {
      setupHook({ loading: false, tasks: [] });
      renderWithProviders(<TaskListPage {...defaultProps} />);
      expect(screen.getByText(/No tasks found/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error display
  // -------------------------------------------------------------------------

  describe("error display", () => {
    it("shows error message text from hook", () => {
      setupHook({ error: "Failed to load tasks" });
      renderWithProviders(<TaskListPage {...defaultProps} />);
      expect(screen.getByText("Failed to load tasks")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CreateTaskOverlay
  // -------------------------------------------------------------------------

  describe("CreateTaskOverlay", () => {
    it("opens when '+ New Task' button is clicked", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));
      expect(screen.getByText("New Task")).toBeInTheDocument();
    });

    it("form has title input, description textarea, area dropdown, effort dropdown", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));

      expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Description (optional)")).toBeInTheDocument();
      // Area and effort dropdowns in the overlay form row
      expect(screen.getByText("Area...")).toBeInTheDocument();
      expect(screen.getByText("Effort...")).toBeInTheDocument();
    });

    it("submit calls createTasks with form data", async () => {
      mockCreateTasks.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));

      fireEvent.change(screen.getByPlaceholderText("Task title"), {
        target: { value: "New task title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Description (optional)"), {
        target: { value: "Some description" },
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreateTasks).toHaveBeenCalledWith([{
          title: "New task title",
          description: "Some description",
          area: undefined,
          effort: undefined,
        }]);
      });
    });

    it("closes on cancel button click", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));
      expect(screen.getByText("New Task")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("New Task")).not.toBeInTheDocument();
    });

    it("closes on backdrop click", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));
      expect(screen.getByText("New Task")).toBeInTheDocument();

      // Click the overlay backdrop
      const backdrop = screen.getByText("New Task").closest("form")!.parentElement!;
      fireEvent.click(backdrop);

      expect(screen.queryByText("New Task")).not.toBeInTheDocument();
    });

    it("does not submit when title is empty", async () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));
      fireEvent.click(screen.getByText("Create"));

      // Should not call createTasks since title is empty
      await new Promise((r) => setTimeout(r, 50));
      expect(mockCreateTasks).not.toHaveBeenCalled();
    });

    it("calls refetch after successful creation", async () => {
      mockCreateTasks.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Task"));
      fireEvent.change(screen.getByPlaceholderText("Task title"), {
        target: { value: "New task" },
      });
      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Task navigation
  // -------------------------------------------------------------------------

  describe("task navigation", () => {
    it("clicking a TaskCard calls onNavigate with /tasks/{id}", () => {
      const tasks = [makeHomeTaskSummary({ id: "task-123", title: "Click Me" })];
      setupHook({ tasks, total: 1 });
      const onNavigate = vi.fn();
      renderWithProviders(<TaskListPage {...defaultProps} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByText("Click Me"));
      expect(onNavigate).toHaveBeenCalledWith("/tasks/task-123");
    });

    it("Enter key on TaskCard triggers onClick", () => {
      const tasks = [makeHomeTaskSummary({ id: "task-123", title: "Press Enter" })];
      setupHook({ tasks, total: 1 });
      const onNavigate = vi.fn();
      renderWithProviders(<TaskListPage {...defaultProps} onNavigate={onNavigate} />);

      const card = screen.getByText("Press Enter").closest("[role='button']")!;
      fireEvent.keyDown(card, { key: "Enter" });
      expect(onNavigate).toHaveBeenCalledWith("/tasks/task-123");
    });
  });

  // -------------------------------------------------------------------------
  // Gallery view
  // -------------------------------------------------------------------------

  describe("gallery view", () => {
    it("renders grid container when viewMode='gallery'", () => {
      const tasks = [makeHomeTaskSummary({ id: "t1", title: "Gallery Task" })];
      setupHook({ tasks, total: 1 });
      renderWithProviders(<TaskListPage {...defaultProps} viewMode="gallery" />);

      const gridContainer = screen.getByText("Gallery Task").closest("[style*='display: grid']");
      expect(gridContainer).toBeTruthy();
    });

    it("gallery cards show 'Has description' indicator when has_description is true", () => {
      const tasks = [makeHomeTaskSummary({ id: "t1", title: "Desc Task", has_description: true })];
      setupHook({ tasks, total: 1 });
      renderWithProviders(<TaskListPage {...defaultProps} viewMode="gallery" />);

      expect(screen.getByText("Has description")).toBeInTheDocument();
    });

    it("does not show 'Has description' in list mode", () => {
      const tasks = [makeHomeTaskSummary({ id: "t1", title: "Desc Task", has_description: true })];
      setupHook({ tasks, total: 1 });
      renderWithProviders(<TaskListPage {...defaultProps} viewMode="list" />);

      expect(screen.queryByText("Has description")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // View toggle
  // -------------------------------------------------------------------------

  describe("view toggle", () => {
    it("shows List label in list mode", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} viewMode="list" />);
      expect(screen.getByText("List")).toBeInTheDocument();
    });

    it("shows Grid label in gallery mode", () => {
      setupHook();
      renderWithProviders(<TaskListPage {...defaultProps} viewMode="gallery" />);
      expect(screen.getByText("Grid")).toBeInTheDocument();
    });

    it("onClick calls onToggleViewMode", () => {
      setupHook();
      const onToggle = vi.fn();
      renderWithProviders(<TaskListPage {...defaultProps} onToggleViewMode={onToggle} />);

      fireEvent.click(screen.getByText("List"));
      expect(onToggle).toHaveBeenCalled();
    });
  });
});
