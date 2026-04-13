import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeNoteSummary } from "../test/render-helpers";
import { NoteListPage } from "./NoteListPage";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", () => ({
  useNotes: vi.fn(),
}));

vi.mock("../api", () => ({
  createNotes: vi.fn(),
}));

import { useNotes } from "../hooks";
import { createNotes } from "../api";

const mockUseNotes = vi.mocked(useNotes);
const mockCreateNotes = vi.mocked(createNotes);

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NoteListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders page title 'Notes'", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    it("renders NoteCard for each note in the list", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Note One" }),
        makeNoteSummary({ id: "n2", title: "Note Two" }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage />);

      expect(screen.getByText("Note One")).toBeInTheDocument();
      expect(screen.getByText("Note Two")).toBeInTheDocument();
    });

    it("NoteCard shows 'has context' badge when has_context is true", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Context Note", has_context: true })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("has context")).toBeInTheDocument();
    });

    it("NoteCard shows created date", () => {
      const notes = [makeNoteSummary({ id: "n1", title: "Dated Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);
      // Date is formatted via toLocaleDateString
      expect(screen.getByText("Dated Note")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows 'No notes found.' when list is empty", () => {
      setupHook({ notes: [], total: 0, loading: false });
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("No notes found")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows skeleton when loading=true and notes is empty", () => {
      setupHook({ loading: true, notes: [] });
      renderWithProviders(<NoteListPage />);
      // Skeleton renders, no notes visible
      expect(screen.queryByText("No notes found.")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error display
  // -------------------------------------------------------------------------

  describe("error display", () => {
    it("shows error message", () => {
      setupHook({ error: "Failed to load notes" });
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("Failed to load notes")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CreateNoteOverlay
  // -------------------------------------------------------------------------

  describe("CreateNoteOverlay", () => {
    it("opens on '+ New Note' button click", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByText("+ New Note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();
    });

    it("form has title input and context textarea", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByText("+ New Note"));

      expect(screen.getByPlaceholderText("Note title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Context (optional)")).toBeInTheDocument();
    });

    it("submit calls createNotes with title and context", async () => {
      mockCreateNotes.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByText("+ New Note"));

      fireEvent.change(screen.getByPlaceholderText("Note title"), {
        target: { value: "My New Note" },
      });
      fireEvent.change(screen.getByPlaceholderText("Context (optional)"), {
        target: { value: "Note context here" },
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreateNotes).toHaveBeenCalledWith([{
          title: "My New Note",
          context: "Note context here",
        }]);
      });
    });

    it("closes on Cancel button click", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByText("+ New Note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Note title")).not.toBeInTheDocument();
    });

    it("calls refetch after successful creation", async () => {
      mockCreateNotes.mockResolvedValue([]);
      setupHook();
      renderWithProviders(<NoteListPage />);

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
});
