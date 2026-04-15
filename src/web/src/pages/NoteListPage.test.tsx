import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeNoteSummary } from "../test/render-helpers";
import { NoteListPage } from "./NoteListPage";

// ---------------------------------------------------------------------------
// Mock hooks and api
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();

vi.mock("../hooks", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../hooks");
  return {
    ...actual,
    useNotes: vi.fn(),
    useWindowWidth: vi.fn(() => 1024),
    SMALL_BREAKPOINT: 768,
  };
});

vi.mock("../api", () => ({
  fetchNote: vi.fn(),
  createNotes: vi.fn(),
  updateNotes: vi.fn(),
  deleteNotes: vi.fn(),
}));

vi.mock("@4lt7ab/ui/content", () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

import { useNotes } from "../hooks";
import { fetchNote, createNotes, updateNotes, deleteNotes } from "../api";

const mockUseNotes = vi.mocked(useNotes);
const mockFetchNote = vi.mocked(fetchNote);
const mockCreateNotes = vi.mocked(createNotes);
const mockUpdateNotes = vi.mocked(updateNotes);
const mockDeleteNotes = vi.mocked(deleteNotes);

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

const FULL_NOTE = {
  id: "n1",
  title: "Test Note",
  context: "Some **markdown** content",
  created_at: "2026-04-10T12:00:00.000Z",
  updated_at: "2026-04-10T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NoteListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNote.mockResolvedValue(FULL_NOTE);
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

    it("renders note items in the sidebar", () => {
      const notes = [
        makeNoteSummary({ id: "n1", title: "Note One" }),
        makeNoteSummary({ id: "n2", title: "Note Two" }),
      ];
      setupHook({ notes, total: 2 });
      renderWithProviders(<NoteListPage />);

      expect(screen.getByText("Note One")).toBeInTheDocument();
      expect(screen.getByText("Note Two")).toBeInTheDocument();
    });

    it("shows total count next to title", () => {
      const notes = [makeNoteSummary({ id: "n1" })];
      setupHook({ notes, total: 5 });
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("renders search input", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);
      expect(screen.getByPlaceholderText("Search notes...")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows empty message when no notes exist", () => {
      setupHook({ notes: [], total: 0, loading: false });
      renderWithProviders(<NoteListPage />);
      expect(screen.getByText("No notes yet")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows skeletons when loading and notes is empty", () => {
      setupHook({ loading: true, notes: [] });
      renderWithProviders(<NoteListPage />);
      expect(screen.queryByText("No notes yet")).not.toBeInTheDocument();
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
  // Note detail
  // -------------------------------------------------------------------------

  describe("note detail", () => {
    it("auto-loads first note on mount", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "First Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);

      await waitFor(() => {
        expect(mockFetchNote).toHaveBeenCalledWith("n1");
      });
    });

    it("renders note content via Markdown when loaded", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "First Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);

      await waitFor(() => {
        expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
      });
      expect(screen.getByTestId("markdown-content")).toHaveTextContent("Some **markdown** content");
    });

    it("shows edit and delete icon buttons in detail panel", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "First Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Edit note")).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Delete note")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // CreateNoteOverlay
  // -------------------------------------------------------------------------

  describe("CreateNoteOverlay", () => {
    it("opens on new note button click", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByLabelText("New note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();
    });

    it("submits with title and context", async () => {
      mockCreateNotes.mockResolvedValue([{ ...FULL_NOTE, id: "new-1" }]);
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByLabelText("New note"));

      fireEvent.change(screen.getByPlaceholderText("Note title"), {
        target: { value: "My New Note" },
      });
      fireEvent.change(screen.getByPlaceholderText("Write something..."), {
        target: { value: "Note body" },
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreateNotes).toHaveBeenCalledWith([{
          title: "My New Note",
          context: "Note body",
        }]);
      });
    });

    it("closes on Cancel", () => {
      setupHook();
      renderWithProviders(<NoteListPage />);

      fireEvent.click(screen.getByLabelText("New note"));
      expect(screen.getByText("New Note")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByPlaceholderText("Note title")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // EditNoteOverlay
  // -------------------------------------------------------------------------

  describe("EditNoteOverlay", () => {
    it("opens when edit button is clicked and pre-fills fields", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "First Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Edit note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Edit note"));

      expect(screen.getByText("Edit Note")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test Note")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  describe("delete", () => {
    it("shows confirm dialog when delete button is clicked", async () => {
      const notes = [makeNoteSummary({ id: "n1", title: "First Note" })];
      setupHook({ notes, total: 1 });
      renderWithProviders(<NoteListPage />);

      await waitFor(() => {
        expect(screen.getByLabelText("Delete note")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("Delete note"));

      expect(screen.getByText("Delete this note?")).toBeInTheDocument();
    });
  });
});
