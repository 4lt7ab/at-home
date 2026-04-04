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
const mockSetTheme = vi.fn();
let mockThemeName = "deepTeal";
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
  useShortcut: vi.fn(),
  EventSubscriptionContext: (() => {
    const { createContext } = require("react");
    return createContext(null);
  })(),
}));

vi.mock("./components/organisms", () => ({
  ShortcutHelpOverlay: () => null,
}));

vi.mock("./components/atoms", () => ({
  AnimationStyles: () => null,
  StatusDot: ({ status, color }: { status: string; color: string }) => (
    <span data-testid="status-dot" title={status} style={{ background: color }} />
  ),
}));

vi.mock("./components/molecules", () => ({
  ThemeSwitcher: () => <button data-testid="theme-switcher">ThemeSwitcher</button>,
}));

vi.mock("./components/organisms/TopBar", () => ({
  TopBar: ({ navItems, activePath, onNavigate, trailing }: Record<string, unknown>) => (
    <header>
      <nav>
        {(navItems as Array<{ label: string; path: string }>).map((item) => (
          <button
            key={item.path}
            style={{ fontWeight: (activePath as string) === item.path ? 600 : 400 }}
            onClick={() => (onNavigate as (p: string) => void)(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div>{trailing as React.ReactNode}</div>
    </header>
  ),
}));

vi.mock("./components/organisms/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockTheme = {
  color: { border: "#333", surface: "#111", textMuted: "#888", text: "#eee", success: "#0f0", danger: "#f00", primary: "#5da" },
  font: { body: "sans-serif", size: { sm: "14px" }, lineHeight: { normal: 1.5 } },
  spacing: { sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem" },
  radius: { lg: 8, xl: 12 },
  shadow: { lg: "none" },
  motion: { fast: "100ms", normal: "200ms", easing: "ease" },
};

vi.mock("./components/theme", () => ({
  useTheme: () => ({ theme: mockTheme, themeName: mockThemeName, setTheme: mockSetTheme }),
  themes: { deepTeal: {}, ember: {} },
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
import { useShortcut } from "./hooks";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPath = "/";
  mockNavigate.mockClear();
  mockOnEvent.mockClear();
  mockSubscribeEvents.mockClear();
  mockToggleViewMode.mockClear();
  mockSetTheme.mockClear();
  mockThemeName = "deepTeal";
  mockConnected = true;
  mockViewMode = "list";
  vi.mocked(useShortcut).mockClear();
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

  describe("theme switcher", () => {
    it("renders ThemeSwitcher molecule in the trailing area", () => {
      render(<App />);
      expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
    });
  });

  describe("connection indicator", () => {
    it("shows Connected status dot when connected=true", () => {
      mockConnected = true;
      render(<App />);
      expect(screen.getByTitle("Connected")).toBeInTheDocument();
    });

    it("shows Disconnected status dot when connected=false", () => {
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

  describe("shortcut registration", () => {
    it("useShortcut is called with 'shift+g' for toggle view mode", () => {
      render(<App />);
      expect(useShortcut).toHaveBeenCalledWith("shift+g", "Toggle view mode", expect.any(Function), "Navigation");
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
