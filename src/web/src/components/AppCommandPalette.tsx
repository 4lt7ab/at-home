import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "@4lt7ab/ui/ui";
import { semantic as t, useTheme } from "@4lt7ab/ui/core";
import type { LogSummary } from "@domain/entities";
import { useLogs, useHashRoute } from "../hooks";
import { useShortcut, useShortcutSuppression } from "../hooks";
import { firePaletteAction } from "../hooks/usePaletteActions";
import { usePaletteFrecency } from "../hooks/usePaletteFrecency";
import { createLogEntry } from "../api";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";

// ---------------------------------------------------------------------------
// AppCommandPalette
//
// App-level Cmd+K palette per design doc 01KPM9VKE6GJ6WMRZV24ZJJ882.
// Commands:
//   Navigation: Go to Notes / Reminders / Logs
//   Create:     New note / New reminder / New log / Backdate log entry…
//   Quick log:  Log it: <log.name>, one per log, frecency-ranked
//   View:       Cycle theme
//   Help:       Show keyboard shortcuts
//
// Frecency writes on firing. Mid-session Quick log order is captured on
// palette open (via `openedAt` state) and does not reorder as the user
// types or arrow-keys; next open re-reads the frecency store.
// ---------------------------------------------------------------------------

function sortQuickLog(
  logs: LogSummary[],
  scoreFor: (id: string) => number,
): LogSummary[] {
  const withScore = logs.map((log) => ({ log, score: scoreFor(log.id) }));
  withScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: last_logged_at descending
    const la = a.log.last_logged_at ?? "";
    const lb = b.log.last_logged_at ?? "";
    if (la !== lb) return lb.localeCompare(la);
    // Final tiebreak: alphabetical
    return a.log.name.localeCompare(b.log.name);
  });
  return withScore.map((x) => x.log);
}

export function AppCommandPalette(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const { navigate } = useHashRoute();
  const { logs } = useLogs({ limit: 200 });
  const frecency = usePaletteFrecency();
  const { theme, themes, setTheme } = useTheme();

  // Suppress single-letter shortcuts while the palette is open — defense in
  // depth against future refactors (the palette's current <input> is already
  // covered by IGNORED_TAGS, but this stays correct if the input ever moves
  // to contenteditable or the palette mounts a richer editor).
  useShortcutSuppression(open);

  // Register ? as a global "show keyboard shortcuts" shortcut.
  useShortcut("?", "Show keyboard shortcuts", () => setHelpOpen(true), "Help");

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setOpenedAt(Date.now());
      // Clean up frecency entries for logs that no longer exist.
      frecency.prune(new Set(logs.map((l) => l.id)));
    }
  }, [frecency, logs]);

  // Workarounds for three @4lt7ab/ui CommandPalette.Content bugs:
  //
  //   1. Autofocus-doesn't-open: the inner Combobox only calls openMenu()
  //      on input focus when items.length > 0. At autofocus time, items
  //      are still registering via useEffect, so aria-expanded stays
  //      false and the options div is `hidden` until the user types.
  //      Fix: dispatch a synthetic ArrowDown keydown once at least one
  //      option has mounted — the Combobox wrapper's handleKeyDown calls
  //      openMenu() on ArrowDown/ArrowUp when closed, which bypasses the
  //      items-length check.
  //
  //   2. Panel-clips-listbox: the Panel uses `overflow: hidden` + a flex
  //      column layout with the Combobox inside, but Combobox.List is
  //      `position: absolute` and positions `top: 100%` of the Combobox
  //      wrapper. That places the listbox AT or BELOW the panel's bottom
  //      edge where `overflow: hidden` clips it. Fix: flip the panel to
  //      `overflow: visible` so options render into the viewport.
  //
  //   3. Enter-doesn't-fire-onSelect: CommandPalette.Item's `onSelect` is
  //      wired through the inner span's onClick, not Combobox.Root's
  //      onSelect. Pressing Enter triggers Combobox's selectItem which
  //      only sets the input text — it never reaches the Item's span
  //      click handler, so keyboard selection is broken. Fix: a
  //      document-level Enter listener finds the focused option via
  //      aria-activedescendant and synthesizes a click on its inner span.
  //
  // MutationObserver is used rather than requestAnimationFrame because
  // background tabs throttle rAF to ~0 Hz and the prime callback would
  // never fire. MutationObserver runs on microtasks and is not throttled.
  // Filed as follow-up tasks; upstream should fix these at the organism
  // level so consumers don't keep wrapping around them.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const prime = (): boolean => {
      if (cancelled) return false;
      const panel = document.querySelector<HTMLElement>(
        '[data-testid="command-palette-content"]',
      );
      if (!panel) return false;
      // Unclip the panel so the absolute-positioned listbox is visible.
      if (panel.style.overflow !== "visible") {
        panel.style.overflow = "visible";
      }
      const input = panel.querySelector<HTMLInputElement>('[role="combobox"]');
      if (!input) return false;
      if (input.getAttribute("aria-expanded") === "true") return true;
      const hasOptions = panel.querySelector(
        '[role="listbox"] [role="option"]',
      );
      if (!hasOptions) return false;
      if (document.activeElement !== input) input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      return true;
    };

    if (prime()) return () => { cancelled = true; };

    const observer = new MutationObserver(() => {
      if (prime()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const fallback = window.setTimeout(() => {
      prime();
      observer.disconnect();
    }, 250);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [open]);

  // Workaround #3: intercept Enter on the palette input and click the
  // currently-focused option's inner span directly. See the useEffect
  // above for the rationale. Capture phase so we beat the Combobox's
  // default Enter-handling (which sets the input's value to the option
  // text rather than firing the palette's onSelect).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== "Enter") return;
      const panel = document.querySelector<HTMLElement>(
        '[data-testid="command-palette-content"]',
      );
      if (!panel) return;
      const input = panel.querySelector<HTMLInputElement>('[role="combobox"]');
      if (!input || document.activeElement !== input) return;
      const activeId = input.getAttribute("aria-activedescendant");
      if (!activeId) return;
      const option = document.getElementById(activeId);
      if (!option) return;
      const span = option.querySelector<HTMLElement>("span");
      if (!span) return;
      e.preventDefault();
      e.stopPropagation();
      span.click();
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open]);

  // Order captured at open time so arrow-keys don't re-sort under the cursor.
  const orderedLogs = useMemo(() => {
    if (openedAt === 0) return logs;
    return sortQuickLog(logs, (id) => frecency.score(id, openedAt));
  }, [logs, frecency, openedAt]);

  const handleLogIt = useCallback(async (log: LogSummary) => {
    frecency.record(log.id);
    try {
      await createLogEntry(log.id);
    } catch {
      // Quiet; LogsPage has its own error surface. The websocket refresh will
      // reconcile the count either way.
    }
  }, [frecency]);

  const cycleTheme = useCallback(() => {
    const names = Object.keys(themes);
    if (names.length === 0) return;
    const idx = names.indexOf(theme);
    const next = names[(idx + 1) % names.length];
    setTheme(next);
  }, [theme, themes, setTheme]);

  return (
    <>
      <CommandPalette.Root
        aria-label="Command palette"
        open={open}
        onOpenChange={handleOpenChange}
      >
        <CommandPalette.Trigger asChild>
          <button
            type="button"
            data-testid="command-palette-trigger"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: t.spaceXs,
              background: "transparent",
              border: `${t.borderWidthDefault} solid ${t.colorBorder}`,
              color: t.colorTextMuted,
              borderRadius: t.radiusMd,
              padding: `${t.spaceXs} ${t.spaceSm}`,
              fontSize: t.fontSizeSm,
              fontFamily: t.fontSans,
              cursor: "pointer",
            }}
          >
            <span>Search</span>
            <kbd
              style={{
                padding: `0 ${t.spaceXs}`,
                background: t.colorSurfaceRaised,
                border: `${t.borderWidthDefault} solid ${t.colorBorder}`,
                borderRadius: t.radiusSm,
                fontSize: t.fontSizeXs,
                fontFamily: t.fontMono,
                color: t.colorTextMuted,
              }}
            >
              {typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent ?? "")
                ? "⌘K"
                : "Ctrl+K"}
            </kbd>
          </button>
        </CommandPalette.Trigger>

        <CommandPalette.Content placeholder="Type a command or search…">
          <CommandPalette.Group label="Navigation">
            <CommandPalette.Item
              value="go-to-notes"
              keywords={["notes"]}
              onSelect={() => navigate("/")}
            >
              Go to Notes
            </CommandPalette.Item>
            <CommandPalette.Item
              value="go-to-reminders"
              keywords={["reminders"]}
              onSelect={() => navigate("/reminders")}
            >
              Go to Reminders
            </CommandPalette.Item>
            <CommandPalette.Item
              value="go-to-logs"
              keywords={["logs"]}
              onSelect={() => navigate("/logs")}
            >
              Go to Logs
            </CommandPalette.Item>
          </CommandPalette.Group>

          <CommandPalette.Group label="Create">
            <CommandPalette.Item
              value="new-note"
              keywords={["create", "note"]}
              onSelect={() => {
                navigate("/");
                // Fire after navigation so NoteListPage has mounted and
                // subscribed. The page is already mounted if the user was
                // on it; navigate() is a no-op in that case.
                firePaletteAction("new-note");
              }}
            >
              New note
            </CommandPalette.Item>
            <CommandPalette.Item
              value="new-reminder"
              keywords={["create", "reminder"]}
              onSelect={() => {
                navigate("/reminders");
                firePaletteAction("new-reminder");
              }}
            >
              New reminder
            </CommandPalette.Item>
            <CommandPalette.Item
              value="new-log"
              keywords={["create", "log", "definition"]}
              onSelect={() => {
                navigate("/logs");
                firePaletteAction("new-log");
              }}
            >
              New log
            </CommandPalette.Item>
          </CommandPalette.Group>

          <CommandPalette.Group label="Quick log">
            {orderedLogs.map((log) => (
              <CommandPalette.Item
                key={log.id}
                value={`log-it-${log.id}`}
                keywords={[log.name.toLowerCase(), "log", "quick"]}
                onSelect={() => handleLogIt(log)}
              >
                {`Log it: ${log.name}`}
              </CommandPalette.Item>
            ))}
          </CommandPalette.Group>

          <CommandPalette.Group label="View">
            <CommandPalette.Item
              value="cycle-theme"
              keywords={["theme", "dark", "light", "appearance"]}
              onSelect={cycleTheme}
            >
              Cycle theme
            </CommandPalette.Item>
          </CommandPalette.Group>

          <CommandPalette.Group label="Help">
            <CommandPalette.Item
              value="show-shortcuts"
              keywords={["help", "shortcuts", "keys"]}
              shortcut="?"
              onSelect={() => setHelpOpen(true)}
            >
              Show keyboard shortcuts
            </CommandPalette.Item>
          </CommandPalette.Group>
        </CommandPalette.Content>
      </CommandPalette.Root>

      {helpOpen && <KeyboardShortcutsOverlay onClose={() => setHelpOpen(false)} />}
    </>
  );
}
