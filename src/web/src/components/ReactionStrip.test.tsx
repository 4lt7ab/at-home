import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../test/render-helpers";
import { ReactionStrip } from "./ReactionStrip";
import { PALETTE } from "@domain/services/log-entries";

describe("ReactionStrip", () => {
  it("renders all 9 palette emojis as tappable buttons", () => {
    renderWithProviders(
      <ReactionStrip logId="log-1" entryId="entry-1" reactions={[]} onReact={vi.fn()} />,
    );
    for (const emoji of PALETTE) {
      expect(screen.getByRole("button", { name: `React with ${emoji}` })).toBeInTheDocument();
    }
    // 9 emojis total
    expect(PALETTE.length).toBe(9);
    expect(screen.getAllByRole("button")).toHaveLength(9);
  });

  it("only shows count badge when count > 0", () => {
    renderWithProviders(
      <ReactionStrip
        logId="log-1"
        entryId="entry-1"
        reactions={[{ emoji: "❤️", count: 3 }, { emoji: "🔥", count: 0 }]}
        onReact={vi.fn()}
      />,
    );
    expect(screen.getByTestId("reaction-count-❤️")).toHaveTextContent("3");
    // 🔥 has count 0 → no badge element
    expect(screen.queryByTestId("reaction-count-🔥")).not.toBeInTheDocument();
    // an untouched emoji also has no badge
    expect(screen.queryByTestId("reaction-count-👍")).not.toBeInTheDocument();
  });

  it("tapping a chip calls onReact with (logId, entryId, emoji)", async () => {
    const onReact = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ReactionStrip logId="log-xyz" entryId="entry-abc" reactions={[]} onReact={onReact} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "React with 🎉" }));
    await waitFor(() => {
      expect(onReact).toHaveBeenCalledWith("log-xyz", "entry-abc", "🎉");
    });
  });

  it("optimistically reflects the new count before the server responds", async () => {
    // Hold the promise open so the optimistic state is observable.
    let resolveReact: (value: unknown) => void = () => {};
    const onReact = vi.fn(
      () => new Promise((res) => { resolveReact = res; }),
    );

    renderWithProviders(
      <ReactionStrip
        logId="log-1"
        entryId="entry-1"
        reactions={[{ emoji: "❤️", count: 2 }]}
        onReact={onReact}
      />,
    );

    expect(screen.getByTestId("reaction-count-❤️")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "React with ❤️" }));

    // Before resolving the server call, the optimistic count should be 3.
    await waitFor(() => {
      expect(screen.getByTestId("reaction-count-❤️")).toHaveTextContent("3");
    });
    expect(onReact).toHaveBeenCalledWith("log-1", "entry-1", "❤️");

    // Resolve the pending POST — the component keeps the optimistic value
    // (the WebSocket refetch is what would reconcile; not simulated here).
    resolveReact({});
  });

  it("optimistically bumps from zero when tapping an unset emoji", async () => {
    const onReact = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <ReactionStrip logId="log-1" entryId="entry-1" reactions={[]} onReact={onReact} />,
    );
    expect(screen.queryByTestId("reaction-count-🪄")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "React with 🪄" }));

    await waitFor(() => {
      expect(screen.getByTestId("reaction-count-🪄")).toHaveTextContent("1");
    });
  });

  it("reverts the optimistic bump if the server call fails", async () => {
    const onReact = vi.fn().mockRejectedValue(new Error("boom"));
    renderWithProviders(
      <ReactionStrip
        logId="log-1"
        entryId="entry-1"
        reactions={[{ emoji: "👍", count: 1 }]}
        onReact={onReact}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "React with 👍" }));

    await waitFor(() => {
      expect(screen.getByTestId("reaction-count-👍")).toHaveTextContent("1");
    });
  });
});
