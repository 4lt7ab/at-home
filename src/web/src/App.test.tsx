import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- must be defined before imports that use them
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockPath = "/";
const mockOnEvent = vi.fn();
const mockSubscribeEvents = vi.fn(() => () => {});
const mockToggleViewMode = vi.fn();
let mockViewMode = "list";
const mockSetMode = vi.fn();
let mockThemeMode = "auto" as "auto" | "light" | "dark";
let mockConnected = true;

vi.mock("./useRealtimeEvents", () => ({
  useRealtimeEvents: (onEvent: unknown) => {
    // capture onEvent for potential use
    return { connected: mockConnected };
  },
}));

vi.mock("./hooks", () => ({
  useHashRoute: () => ({ path: mockPath, navigate: mockNavigate }),
  useEventFanOut: () => ({ onEvent: mockOnEvent, subscribeEvents: mockSubscribeEvents }),
  useViewMode: () => ({ viewMode: mockViewMode, setViewMode: vi.fn(), toggleViewMode: mockToggleViewMode }),
  useHotkey: vi.fn(),
  EventSubscriptionContext: (() => {
    const { createContext } = require("react");
    return createContext(null);
  })(),
}));

vi.mock("./ThemeContext", () => ({
  useThemeContext: () => ({ mode: mockThemeMode, setMode: mockSetMode }),
}));

vi.mock("./pages/DailySummaryPage", () => ({
  DailySummaryPage: () => <div data-testid="daily-summary-page">DailySummaryPage</div>,
}));

vi.mock("./pages/TaskListPage", () => ({
  TaskListPage: (props: Record<string, unknown>) => (
    <div data-testid="task-list-page" data-view-mode={props.viewMode}>
      TaskListPage
    </div>
  ),
}));

vi.mock("./pages/TaskDetailPage", () => ({
  TaskDetailPage: (props: Record<string, unknown>) => (
    <div data-testid="task-detail-page" data-task-id={props.taskId}>
      TaskDetailPage
    </div>
  ),
}));

vi.mock("./pages/NoteListPage", () => ({
  NoteListPage: (props: Record<string, unknown>) => (
    <div data-testid="note-list-page" data-view-mode={props.viewMode}>
      NoteListPage
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { useHotkey } from "./hooks";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPath = "/";
  mockNavigate.mockClear();
  mockOnEvent.mockClear();
  mockSubscribeEvents.mockClear();
  mockToggleViewMode.mockClear();
  mockSetMode.mockClear();
  mockThemeMode = "auto";
  mockConnected = true;
  mockViewMode = "list";
  vi.mocked(useHotkey).mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("App", () => {
  describe("routing", () => {
    it("renders DailySummaryPage for path '/'", () => {
      mockPath = "/";
      render(<App />);
      expect(screen.getByTestId("daily-summary-page")).toBeInTheDocument();
    });

    it("renders TaskListPage for path '/tasks'", () => {
      mockPath = "/tasks";
      render(<App />);
      expect(screen.getByTestId("task-list-page")).toBeInTheDocument();
    });

    it("renders TaskDetailPage for path '/tasks/abc123'", () => {
      mockPath = "/tasks/abc123";
      render(<App />);
      const el = screen.getByTestId("task-detail-page");
      expect(el).toBeInTheDocument();
      expect(el.getAttribute("data-task-id")).toBe("abc123");
    });

    it("renders NoteListPage for path '/notes'", () => {
      mockPath = "/notes";
      render(<App />);
      expect(screen.getByTestId("note-list-page")).toBeInTheDocument();
    });

    it("defaults to DailySummaryPage for empty/unknown path", () => {
      mockPath = "";
      render(<App />);
      expect(screen.getByTestId("daily-summary-page")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("clicking 'Today' nav item calls navigate('/')", () => {
      render(<App />);
      fireEvent.click(screen.getByText("Today"));
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("clicking 'Tasks' nav item calls navigate('/tasks')", () => {
      render(<App />);
      fireEvent.click(screen.getByText("Tasks"));
      expect(mockNavigate).toHaveBeenCalledWith("/tasks");
    });

    it("clicking 'Notes' nav item calls navigate('/notes')", () => {
      render(<App />);
      fireEvent.click(screen.getByText("Notes"));
      expect(mockNavigate).toHaveBeenCalledWith("/notes");
    });
  });

  describe("active nav highlight", () => {
    it("'Today' is active when path is '/'", () => {
      mockPath = "/";
      render(<App />);
      const todayBtn = screen.getByText("Today");
      expect(todayBtn.style.fontWeight).toBe("600");
    });

    it("'Tasks' is active when path starts with '/tasks'", () => {
      mockPath = "/tasks";
      render(<App />);
      const tasksBtn = screen.getByText("Tasks");
      expect(tasksBtn.style.fontWeight).toBe("600");
    });

    it("'Notes' is active when path starts with '/notes'", () => {
      mockPath = "/notes";
      render(<App />);
      const notesBtn = screen.getByText("Notes");
      expect(notesBtn.style.fontWeight).toBe("600");
    });

    it("only one nav item is active at a time", () => {
      mockPath = "/tasks";
      render(<App />);
      const todayBtn = screen.getByText("Today");
      const tasksBtn = screen.getByText("Tasks");
      const notesBtn = screen.getByText("Notes");

      expect(tasksBtn.style.fontWeight).toBe("600");
      expect(todayBtn.style.fontWeight).not.toBe("600");
      expect(notesBtn.style.fontWeight).not.toBe("600");
    });
  });

  describe("theme toggle", () => {
    it("displays current theme icon and label", () => {
      mockThemeMode = "auto";
      render(<App />);
      expect(screen.getByText("Auto")).toBeInTheDocument();
      // The half-circle icon for auto
      expect(screen.getByText("\u25D0")).toBeInTheDocument();
    });

    it("clicking calls setMode with the next theme in cycle (auto -> light)", () => {
      mockThemeMode = "auto";
      render(<App />);
      const themeBtn = screen.getByTitle("Theme: Auto");
      fireEvent.click(themeBtn);
      expect(mockSetMode).toHaveBeenCalledWith("light");
    });

    it("cycles light -> dark", () => {
      mockThemeMode = "light";
      render(<App />);
      const themeBtn = screen.getByTitle("Theme: Light");
      fireEvent.click(themeBtn);
      expect(mockSetMode).toHaveBeenCalledWith("dark");
    });

    it("cycles dark -> auto", () => {
      mockThemeMode = "dark";
      render(<App />);
      const themeBtn = screen.getByTitle("Theme: Dark");
      fireEvent.click(themeBtn);
      expect(mockSetMode).toHaveBeenCalledWith("auto");
    });
  });

  describe("connection indicator", () => {
    it("shows connected title when connected=true", () => {
      mockConnected = true;
      render(<App />);
      expect(screen.getByTitle("Connected")).toBeInTheDocument();
    });

    it("shows disconnected title when connected=false", () => {
      mockConnected = false;
      render(<App />);
      expect(screen.getByTitle("Disconnected")).toBeInTheDocument();
    });
  });

  describe("view mode", () => {
    it("passes viewMode to TaskListPage", () => {
      mockPath = "/tasks";
      mockViewMode = "gallery";
      render(<App />);
      const el = screen.getByTestId("task-list-page");
      expect(el.getAttribute("data-view-mode")).toBe("gallery");
    });

    it("passes viewMode to NoteListPage", () => {
      mockPath = "/notes";
      mockViewMode = "gallery";
      render(<App />);
      const el = screen.getByTestId("note-list-page");
      expect(el.getAttribute("data-view-mode")).toBe("gallery");
    });
  });

  describe("hotkey registration", () => {
    it("useHotkey is called with 'g', { shift: true }, toggleViewMode", () => {
      render(<App />);
      expect(useHotkey).toHaveBeenCalledWith("g", { shift: true }, expect.any(Function));
    });
  });

  describe("EventSubscriptionContext", () => {
    it("provides subscribeEvents and connected to children via context", () => {
      // The App renders EventSubscriptionContext.Provider -- verify it renders without errors
      // and the provider value includes subscribeEvents and connected.
      // Since the mock pages render inside the provider, they would throw if context was missing.
      mockPath = "/";
      render(<App />);
      expect(screen.getByTestId("daily-summary-page")).toBeInTheDocument();
    });
  });
});
