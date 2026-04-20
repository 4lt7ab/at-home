import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Palette actions — cross-component event bus
//
// The CommandPalette lives at the App level, but the Create overlays live
// inside each page (NoteListPage / ReminderDashboardPage / LogsPage). The
// palette needs to open those overlays from outside the page's component
// tree. A tiny pub-sub mirrors the pattern used by EventBus on the server:
// the palette fires a named action, the page subscribes via useEffect.
//
// Action names are string-typed rather than an enum because we want
// consumers to grep for the exact action name they're wiring, and because
// the palette module, which names them, can't import from every page.
// ---------------------------------------------------------------------------

export type PaletteActionName =
  | "new-note"
  | "new-reminder"
  | "new-log";

type Listener = () => void;

const listeners = new Map<PaletteActionName, Set<Listener>>();
// Pending fires: when the palette fires an action after a navigate(), the
// target page's listener may not have mounted yet. Stash the action on a
// short-lived queue; usePaletteAction drains matching pending entries on
// subscribe. Entries expire after PENDING_TTL_MS to avoid stale firing if
// the page never actually mounts.
const PENDING_TTL_MS = 2000;
interface Pending { action: PaletteActionName; firedAt: number }
let pending: Pending[] = [];

function prunePending(nowMs: number): void {
  pending = pending.filter((p) => nowMs - p.firedAt < PENDING_TTL_MS);
}

/**
 * Fire an action — registered listeners run synchronously. If no listener
 * is registered yet (common when the palette navigates to a target page and
 * that page mounts on the next tick), the action is queued for the next
 * listener registration within PENDING_TTL_MS.
 */
export function firePaletteAction(action: PaletteActionName): void {
  const now = Date.now();
  prunePending(now);
  const set = listeners.get(action);
  if (set && set.size > 0) {
    for (const fn of set) fn();
    return;
  }
  pending.push({ action, firedAt: now });
}

/**
 * Subscribe to a palette action. Wraps an effect so the listener tears
 * down with the component. Intended for use by page-level components
 * that own the create-overlay state.
 */
export function usePaletteAction(
  action: PaletteActionName,
  callback: () => void,
): void {
  useEffect(() => {
    let set = listeners.get(action);
    if (!set) {
      set = new Set();
      listeners.set(action, set);
    }
    set.add(callback);

    // Drain any pending fire for this action that arrived before we mounted.
    const now = Date.now();
    prunePending(now);
    const matching = pending.filter((p) => p.action === action);
    if (matching.length > 0) {
      pending = pending.filter((p) => p.action !== action);
      // Fire this listener once for the most recent pending (not once per
      // queued fire — queue collapsed to a single "please run me"). Deferred
      // to microtask so subscription completes first.
      queueMicrotask(() => callback());
    }

    return () => {
      set!.delete(callback);
      if (set!.size === 0) listeners.delete(action);
    };
  }, [action, callback]);
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

/** Reset all listeners — for testing only. */
export function _resetPaletteActions(): void {
  listeners.clear();
  pending = [];
}

/** Current listener count for a given action — for testing only. */
export function _paletteActionListenerCount(action: PaletteActionName): number {
  return listeners.get(action)?.size ?? 0;
}
