import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeLogSummary } from "../test/render-helpers";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("../hooks/useHashRoute", () => ({
  useHashRoute: () => ({ path: "/", navigate: mockNavigate }),
}));

const mockUseLogs = vi.fn();
vi.mock("../hooks/useLogs", () => ({
  useLogs: (...args: unknown[]) => mockUseLogs(...args),
}));

const mockCreateLogEntry = vi.fn();
vi.mock("../api", () => ({
  createLogEntry: (...args: unknown[]) => mockCreateLogEntry(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AppCommandPalette } from "./AppCommandPalette";
import { _resetShortcutManager, useShortcut } from "../hooks/useKeyboardShortcuts";
import {
  _resetPaletteActions,
  usePaletteAction,
} from "../hooks/usePaletteActions";
import { STORAGE_KEY } from "../hooks/usePaletteFrecency";

beforeEach(() => {
  mockNavigate.mockClear();
  mockCreateLogEntry.mockReset();
  mockCreateLogEntry.mockResolvedValue({ id: "entry-1" });
  mockUseLogs.mockReset();
  mockUseLogs.mockReturnValue({ logs: [], total: 0, loading: false, error: null, refetch: vi.fn() });
  _resetShortcutManager();
  _resetPaletteActions();
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  _resetShortcutManager();
  _resetPaletteActions();
});

async function openPalette() {
  // The organism attaches a document-level keydown listener. jsdom's
  // dispatchEvent runs it synchronously. The CommandPalette uses a single
  // "mod" key that matches metaKey on Mac or ctrlKey elsewhere — jsdom's
  // navigator.userAgent is Linux-like by default, so ctrlKey is the right
  // modifier here.
  await act(async () => {
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppCommandPalette", () => {
  describe("trigger", () => {
    it("renders the trigger button in the tree", () => {
      renderWithProviders(<AppCommandPalette />);
      expect(screen.getByTestId("command-palette-trigger")).toBeInTheDocument();
    });
  });

  describe("Cmd+K opens the palette", () => {
    it("presenting the palette content on Cmd+K", async () => {
      renderWithProviders(<AppCommandPalette />);
      expect(screen.queryByTestId("command-palette-content")).toBeNull();

      await openPalette();

      expect(screen.getByTestId("command-palette-content")).toBeInTheDocument();
    });

    it("presses Escape closes the palette", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();
      expect(screen.getByTestId("command-palette-content")).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      expect(screen.queryByTestId("command-palette-content")).toBeNull();
    });
  });

  describe("navigation commands", () => {
    it("Go to Notes fires navigate('/')", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("Go to Notes"));
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("Go to Reminders fires navigate('/reminders')", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("Go to Reminders"));
      expect(mockNavigate).toHaveBeenCalledWith("/reminders");
    });

    it("Go to Logs fires navigate('/logs')", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("Go to Logs"));
      expect(mockNavigate).toHaveBeenCalledWith("/logs");
    });
  });

  describe("create commands", () => {
    it("New note navigates to / and fires the new-note palette action", async () => {
      // Subscribe a listener to capture the action.
      const spy = vi.fn();
      function Listener(): null {
        usePaletteAction("new-note", spy);
        return null;
      }
      renderWithProviders(
        <>
          <AppCommandPalette />
          <Listener />
        </>,
      );
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("New note"));

      expect(mockNavigate).toHaveBeenCalledWith("/");
      // Listener was already mounted → the action fires synchronously.
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("queues the action when the target page hasn't mounted yet", async () => {
      // Render only the palette — no listener. Fire the command.
      renderWithProviders(<AppCommandPalette />);
      await openPalette();
      const user = userEvent.setup();
      await user.click(screen.getByText("New reminder"));

      // Subsequent listener registration should drain the pending queue.
      const spy = vi.fn();
      function Listener(): null {
        usePaletteAction("new-reminder", spy);
        return null;
      }
      renderWithProviders(<Listener />);

      // Microtask flush
      await Promise.resolve();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("quick log commands", () => {
    it("surfaces one Log it command per log", async () => {
      mockUseLogs.mockReturnValue({
        logs: [
          makeLogSummary({ id: "log-1", name: "Plant watering" }),
          makeLogSummary({ id: "log-2", name: "Trash out" }),
        ],
        total: 2,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      expect(screen.getByText("Log it: Plant watering")).toBeInTheDocument();
      expect(screen.getByText("Log it: Trash out")).toBeInTheDocument();
    });

    it("clicking a Log it command calls createLogEntry and records a frecency hit", async () => {
      mockUseLogs.mockReturnValue({
        logs: [makeLogSummary({ id: "log-1", name: "Plant watering" })],
        total: 1,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("Log it: Plant watering"));

      await waitFor(() => {
        expect(mockCreateLogEntry).toHaveBeenCalledWith("log-1");
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.entries["log-1"].hits.length).toBe(1);
    });

    it("ranks logs by frecency on palette open", async () => {
      // Pre-seed frecency for log-b.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          entries: { "log-b": { hits: [Date.now(), Date.now(), Date.now()] } },
        }),
      );

      mockUseLogs.mockReturnValue({
        logs: [
          makeLogSummary({ id: "log-a", name: "A log" }),
          makeLogSummary({ id: "log-b", name: "B log" }),
          makeLogSummary({ id: "log-c", name: "C log" }),
        ],
        total: 3,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      // Find the options by their Log-it- value prefix in the rendered DOM.
      const logItOptions = Array.from(
        document.querySelectorAll('[data-value^="log-it-"]'),
      ) as HTMLElement[];

      expect(logItOptions.length).toBe(3);
      expect(logItOptions[0].textContent ?? "").toBe("Log it: B log");
    });
  });

  describe("Show keyboard shortcuts command", () => {
    it("opens the shortcuts overlay", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const user = userEvent.setup();
      await user.click(screen.getByText("Show keyboard shortcuts"));

      // Overlay heading
      await waitFor(() => {
        expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
      });
    });
  });

  describe("keyboard selection", () => {
    it("ArrowDown + Enter fires the focused command's onSelect", async () => {
      renderWithProviders(<AppCommandPalette />);
      await openPalette();

      const input = screen.getByRole("combobox");
      // Wait for the priming effect to land ArrowDown and open the menu.
      await waitFor(() => {
        expect(input.getAttribute("aria-expanded")).toBe("true");
      });

      // Move focus to the first option, then press Enter.
      await act(async () => {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      });
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      // First option is "Go to Notes" → navigate('/')
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  describe("shortcut coexistence", () => {
    it("suppresses useShortcut callbacks while the palette is open", async () => {
      // Register an `n` shortcut, open the palette, press n — callback must
      // NOT fire because the palette's open state activates the suppression.
      const cb = vi.fn();
      function ShortcutRegistrar(): null {
        useShortcut("n", "New something", cb, "Test");
        return null;
      }

      renderWithProviders(
        <>
          <AppCommandPalette />
          <ShortcutRegistrar />
        </>,
      );

      await openPalette();

      await act(async () => {
        fireEvent.keyDown(window, { key: "n" });
      });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
