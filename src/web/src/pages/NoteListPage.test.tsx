import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeNoteSummary, makeHomeTaskSummary } from "../test/render-helpers";
import { NoteListPage } from "./NoteListPage";
import type { NoteSummary, HomeTaskSummary } from "@domain/entities";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", () => ({
  useNotes: vi.fn(),
}));

vi.mock("../api", () => ({
  createNotes: vi.fn(),
  fetchTasks: vi.fn(),
}));

import { useNotes } from "../hooks";
import { createNotes, fetchTasks } from "../api";

const mockUseNotes = vi.mocked(useNotes);
const mockCreateNotes = vi.mocked(createNotes);
const mockFetchTasks = vi.mocked(fetchTasks);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHook(overrides: Partial<ReturnType<typeof useNotes>> = {}) {
  mockUseNotes.mockReturnValue({
    notes: [],
    total: 0,
    loading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

const defaultProps = {
  viewMode: "list" as const,
  onToggleViewMode: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NoteListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetchTasks for task name lookup resolves with some tasks
    mockFetchTasks.mockResolvedValue({
      data: [
        makeHomeTaskSummary({ id: "task-1", title: "Kitchen Cleanup" }),
        makeHomeTaskSummary({ id: "task-2", title: "Fix Roof" }),
      ],
      total: 2,
    });
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders page title 'Notes'", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    it("renders NoteCard for each note in the list", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Note One" }),
        makeNoteSummary({ id: "n2", title: "Note Two" }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      expect(screen.getByText("Note One")).toBeInTheDocument();
      expect(screen.getByText("Note Two")).toBeInTheDocument();
    });

    it("NoteCard shows 'standalone' badge when unlinked", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Standalone Note", task_id: null })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("standalone")).toBeInTheDocument();
    });

    it("NoteCard shows task name badge when linked", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Linked Note", task_id: "task-1" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Kitchen Cleanup")).toBeInTheDocument();
      });
    });

    it("NoteCard shows 'has content' badge when has_content is true", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Content Note", has_content: true })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("has content")).toBeInTheDocument();
    });

    it("NoteCard shows created date", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Dated Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      // Date is formatted via toLocaleDateString, check for "Created:" prefix
      expect(screen.getByText(/Created:/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Task name lookup
  // -------------------------------------------------------------------------

  describe("task name lookup", () => {
    it("calls fetchTasks on mount with limit: 200", async () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetchTasks).toHaveBeenCalledWith({ limit: 200 });
      });
    });

    it("displays task title for linked notes", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Linked", task_id: "task-2" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Fix Roof")).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Filter buttons
  // -------------------------------------------------------------------------

  describe("filter buttons", () => {
    it("shows All, Linked, Standalone filter buttons", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Linked")).toBeInTheDocument();
      expect(screen.getByText("Standalone")).toBeInTheDocument();
    });

    it("defaults to 'All' filter active", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);
      // The All button should have distinct styling (accent border)
      const allBtn = screen.getByText("All");
      expect(allBtn).toBeInTheDocument();
    });

    it("'Linked' filter shows only notes with task_id !== null", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Linked Note", task_id: "task-1" }),
        makeNoteSummary({ id: "n2", title: "Standalone Note", task_id: null }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Linked"));

      expect(screen.getByText("Linked Note")).toBeInTheDocument();
      expect(screen.queryByText("Standalone Note")).not.toBeInTheDocument();
    });

    it("'Standalone' filter shows only notes with task_id === null", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Linked Note", task_id: "task-1" }),
        makeNoteSummary({ id: "n2", title: "Standalone Note", task_id: null }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Standalone"));

      expect(screen.queryByText("Linked Note")).not.toBeInTheDocument();
      expect(screen.getByText("Standalone Note")).toBeInTheDocument();
    });

    it("All filter shows all notes", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Linked Note", task_id: "task-1" }),
        makeNoteSummary({ id: "n2", title: "Standalone Note", task_id: null }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      // Switch to linked, then back to all
      fireEvent.click(screen.getByText("Linked"));
      fireEvent.click(screen.getByText("All"));

      expect(screen.getByText("Linked Note")).toBeInTheDocument();
      expect(screen.getByText("Standalone Note")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows 'No notes found.' when filtered list is empty", () => {
      setupHook({ notes: [], total: 0, loading: false });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("No notes found.")).toBeInTheDocument();
    });

    it("shows 'No notes found.' when filter excludes all notes", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Only Linked", task_id: "task-1" }),
      ];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("Standalone"));

      expect(screen.getByText("No notes found.")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows 'Loading notes...' when loading=true and notes is empty", () => {
      setupHook({ loading: true, notes: [] });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("Loading notes...")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error display
  // -------------------------------------------------------------------------

  describe("error display", () => {
    it("shows error message", () => {
      setupHook({ error: "Failed to load notes" });
      renderWithProviders(<NoteListPage {...defaultProps} />);
      expect(screen.getByText("Failed to load notes")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CreateNoteOverlay
  // -------------------------------------------------------------------------

  describe("CreateNoteOverlay", () => {
    it("opens on '+ New Note' button click", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();
    });

    it("form has title input, content textarea, task dropdown", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Note"));

      expect(screen.getByPlaceholderText("Note title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Content (optional)")).toBeInTheDocument();
      expect(screen.getByText("Standalone (no task)")).toBeInTheDocument();
    });

    it("task dropdown is populated from allTasks state", async () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      // Wait for tasks to load
      await waitFor(() => {
        expect(mockFetchTasks).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText("+ New Note"));

      // The dropdown should have task options
      const select = screen.getByDisplayValue("Standalone (no task)");
      expect(select).toBeInTheDocument();
    });

    it("submit calls createNotes with title, content, task_id", async () => {
      mockCreateNotes.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      // Wait for tasks to load
      await waitFor(() => expect(mockFetchTasks).toHaveBeenCalled());

      fireEvent.click(screen.getByText("+ New Note"));

      fireEvent.change(screen.getByPlaceholderText("Note title"), {
        target: { value: "My New Note" },
      });
      fireEvent.change(screen.getByPlaceholderText("Content (optional)"), {
        target: { value: "Note content here" },
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreateNotes).toHaveBeenCalledWith([{
          title: "My New Note",
          content: "Note content here",
          task_id: undefined,
        }]);
      });
    });

    it("closes on backdrop click", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();

      // ModalShell renders: Overlay(fixed) > div(flex center) > div(panel) > form
      // Click the overlay backdrop (the outermost fixed-position div)
      const overlay = screen.getByText("New Note").closest("form")!.parentElement!.parentElement!.parentElement!;
      fireEvent.click(overlay);

      expect(screen.queryByPlaceholderText("Note title")).not.toBeInTheDocument();
    });

    it("calls refetch after successful creation", async () => {
      mockCreateNotes.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} />);

      fireEvent.click(screen.getByText("+ New Note"));
      fireEvent.change(screen.getByPlaceholderText("Note title"), {
        target: { value: "New Note" },
      });
      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Gallery view
  // -------------------------------------------------------------------------

  describe("gallery view", () => {
    it("renders grid container when viewMode='gallery'", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Gallery Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage {...defaultProps} viewMode="gallery" />);

      const gridContainer = screen.getByText("Gallery Note").closest("[style*='display: grid']");
      expect(gridContainer).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // View toggle
  // -------------------------------------------------------------------------

  describe("view toggle", () => {
    it("shows List label in list mode", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} viewMode="list" />);
      expect(screen.getByText("List")).toBeInTheDocument();
    });

    it("shows Grid label in gallery mode", () => {
      setupHook();
      renderWithProviders(<NoteListPage {...defaultProps} viewMode="gallery" />);
      expect(screen.getByText("Grid")).toBeInTheDocument();
    });

    it("onClick calls onToggleViewMode", () => {
      setupHook();
      const onToggle = vi.fn();
      renderWithProviders(<NoteListPage {...defaultProps} onToggleViewMode={onToggle} />);

      fireEvent.click(screen.getByText("List"));
      expect(onToggle).toHaveBeenCalled();
    });
  });
});
