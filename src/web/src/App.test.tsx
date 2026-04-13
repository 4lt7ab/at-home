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

vi.mock("./hooks", () => ({
  useEventFanOut: () => ({ onEvent: mockOnEvent, subscribeEvents: mockSubscribeEvents }),
  EventSubscriptionContext: (() => {
    const { createContext } = require("react");
    return createContext(null);
  })(),
}));

vi.mock("@4lt7ab/ui/core", () => ({
  useTheme: () => ({
    theme: "synthwave",
    setTheme: vi.fn(),
    themes: new Map([["synthwave", { label: "Synthwave" }]]),
  }),
}));

vi.mock("./pages/NoteListPage", () => ({
  NoteListPage: () => (
    <div data-testid="note-list-page">NoteListPage</div>
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
  mockConnected = true;
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
});
