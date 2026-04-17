import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeLogSummary } from "../test/render-helpers";
import { LogsPage } from "./LogsPage";

Element.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks", async () => {
  const actual = await vi.importActual<typeof import("../hooks")>("../hooks");
  return {
    ...actual,
    useLogs: vi.fn(),
    useLogEntries: vi.fn(),
  };
});

vi.mock("../api", () => ({
  createLogs: vi.fn(),
  updateLogs: vi.fn(),
  deleteLogs: vi.fn(),
  createLogEntry: vi.fn(),
  updateLogEntries: vi.fn(),
  updateLogEntry: vi.fn(),
  deleteLogEntries: vi.fn(),
  deleteLogEntry: vi.fn(),
}));

import { useLogs, useLogEntries } from "../hooks";
import { createLogEntry } from "../api";

const mockUseLogs = vi.mocked(useLogs);
const mockUseLogEntries = vi.mocked(useLogEntries);
const mockCreateLogEntry = vi.mocked(createLogEntry);

describe("LogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogs.mockReturnValue({
      logs: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseLogEntries.mockReturnValue({
      entries: [],
      total: 0,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders empty state when no logs", () => {
    renderWithProviders(<LogsPage />);
    expect(screen.getByText(/No logs yet/i)).toBeInTheDocument();
  });

  it("renders + New Log button", () => {
    renderWithProviders(<LogsPage />);
    expect(screen.getByRole("button", { name: /\+ New Log/i })).toBeInTheDocument();
  });

  it("renders list of log cards with last-logged relative time and entry count", () => {
    const logs = [
      makeLogSummary({ id: "l1", name: "Plant watering", entry_count: 5, last_logged_at: new Date(Date.now() - 2 * 3600_000).toISOString() }),
      makeLogSummary({ id: "l2", name: "Trash out", entry_count: 0, last_logged_at: null }),
    ];
    mockUseLogs.mockReturnValue({ logs, total: 2, loading: false, error: null, refetch: vi.fn() });

    renderWithProviders(<LogsPage />);
    expect(screen.getByText("Plant watering")).toBeInTheDocument();
    expect(screen.getByText("Trash out")).toBeInTheDocument();
    expect(screen.getByText(/Never logged/i)).toBeInTheDocument();
    expect(screen.getByText(/5 entries/)).toBeInTheDocument();
    expect(screen.getByText(/0 entries/)).toBeInTheDocument();
    // relative-time string for 2h ago
    expect(screen.getByText(/Last: 2h ago/)).toBeInTheDocument();
  });

  it("Log it button calls createLogEntry with log_id and no occurred_at override", async () => {
    const log = makeLogSummary({ id: "plant-id", name: "Plant watering" });
    mockUseLogs.mockReturnValue({ logs: [log], total: 1, loading: false, error: null, refetch: vi.fn() });
    mockCreateLogEntry.mockResolvedValue({
      id: "entry-1",
      log_id: "plant-id",
      occurred_at: new Date().toISOString(),
      note: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    renderWithProviders(<LogsPage />);

    const button = screen.getByRole("button", { name: /Log it now for Plant watering/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreateLogEntry).toHaveBeenCalledWith("plant-id");
    });
  });

  it("opens new-log modal when + New Log clicked", () => {
    renderWithProviders(<LogsPage />);
    fireEvent.click(screen.getByRole("button", { name: /\+ New Log/i }));
    // Modal: the name input appears
    expect(screen.getByPlaceholderText(/e\.g\. Plant watering/i)).toBeInTheDocument();
  });

  it("drills into entries when log card is clicked", async () => {
    const log = makeLogSummary({ id: "l1", name: "Plant watering" });
    mockUseLogs.mockReturnValue({ logs: [log], total: 1, loading: false, error: null, refetch: vi.fn() });

    renderWithProviders(<LogsPage />);
    // Click the text to expand
    fireEvent.click(screen.getByText("Plant watering"));

    await waitFor(() => {
      expect(screen.getByText(/No entries yet/i)).toBeInTheDocument();
    });
  });
});
