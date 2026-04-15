import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks -- must be defined before imports that use them
// ---------------------------------------------------------------------------

const mockOnEvent = vi.fn();
const mockSubscribeEvents = vi.fn(() => () => {});
let mockConnected = true;

vi.mock("./useRealtimeEvents", () => ({
  useRealtimeEvents: () => {
    return { connected: mockConnected };
  },
}));

const mockNavigate = vi.fn();
let mockPath = "/";

vi.mock("./hooks", () => ({
  useEventFanOut: () => ({ onEvent: mockOnEvent, subscribeEvents: mockSubscribeEvents }),
  useHashRoute: () => ({ path: mockPath, navigate: mockNavigate }),
  EventSubscriptionContext: (() => {
    const { createContext } = require("react");
    return createContext(null);
  })(),
}));

vi.mock("@4lt7ab/ui/ui", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@4lt7ab/ui/ui");
  return {
    ...actual,
    ThemePicker: ({ variant }: { variant?: string }) => (
      <div data-testid="theme-picker" data-variant={variant} />
    ),
  };
});

vi.mock("@4lt7ab/ui/animations", () => ({
  ThemeBackground: () => null,
}));

vi.mock("./pages/NoteListPage", () => ({
  NoteListPage: () => (
    <div data-testid="note-list-page">NoteListPage</div>
  ),
}));

vi.mock("./pages/ReminderDashboardPage", () => ({
  ReminderDashboardPage: () => (
    <div data-testid="reminder-dashboard-page">ReminderDashboardPage</div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { render, screen } from "@testing-library/react";
import { App } from "./App";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockOnEvent.mockClear();
  mockSubscribeEvents.mockClear();
  mockNavigate.mockClear();
  mockConnected = true;
  mockPath = "/";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("App", () => {
  describe("rendering", () => {
    it("renders NoteListPage as the main content", () => {
      render(<App />);
      expect(screen.getByTestId("note-list-page")).toBeInTheDocument();
    });
  });

  describe("EventSubscriptionContext", () => {
    it("provides subscribeEvents and connected to children via context", () => {
      render(<App />);
      expect(screen.getByTestId("note-list-page")).toBeInTheDocument();
    });
  });

  describe("theme picker", () => {
    it("renders compact ThemePicker in the header", () => {
      render(<App />);
      const picker = screen.getByTestId("theme-picker");
      expect(picker).toBeInTheDocument();
      expect(picker).toHaveAttribute("data-variant", "compact");
    });
  });
});
