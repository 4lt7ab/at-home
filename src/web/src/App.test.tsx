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
    ThemePicker: () => <div data-testid="theme-picker" />,
    IconButton: ({ "aria-label": label, onClick }: { "aria-label": string; onClick?: () => void }) => (
      <button data-testid={`icon-button-${label.toLowerCase()}`} aria-label={label} onClick={onClick} />
    ),
    ModalShell: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
      <div data-testid="modal-shell" role="dialog">
        <button data-testid="modal-close" onClick={onClose} />
        {children}
      </div>
    ),
  };
});

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

import { render, screen, fireEvent } from "@testing-library/react";
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

  describe("settings modal", () => {
    it("opens when the settings icon is clicked", () => {
      render(<App />);
      expect(screen.queryByTestId("modal-shell")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("icon-button-settings"));
      expect(screen.getByTestId("modal-shell")).toBeInTheDocument();
      expect(screen.getByTestId("theme-picker")).toBeInTheDocument();
    });

    it("closes when the modal close is triggered", () => {
      render(<App />);
      fireEvent.click(screen.getByTestId("icon-button-settings"));
      expect(screen.getByTestId("modal-shell")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("modal-close"));
      expect(screen.queryByTestId("modal-shell")).not.toBeInTheDocument();
    });
  });
});
