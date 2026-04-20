import { useMemo } from "react";

// ---------------------------------------------------------------------------
// usePaletteFrecency — a minimal frecency store for CommandPalette Quick log.
//
// Design doc 01KPM9VKE6GJ6WMRZV24ZJJ882 specifies:
//   - One localStorage key: `at-home:palette:frecency`.
//   - Shape: { version: 1, entries: { [logId]: { hits: timestamp_ms[] } } }
//   - Cap 20 hits per log (oldest dropped first).
//   - Write on firing, not on preview.
//   - Read lazily; SSR / private mode falls through to empty state.
//   - Score: exp(-dt / HALF_LIFE_MS), half-life one week.
//
// The hook returns a stable object (memoized over the component lifetime).
// Callers recompute ordering on palette open — no React state subscription
// is needed, because mid-session reordering would be disorienting anyway
// (arrow keys on a row that slides out from under the cursor).
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "at-home:palette:frecency";
export const HITS_PER_LOG_CAP = 20;
export const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // one week

interface StoreShape {
  version: 1;
  entries: Record<string, { hits: number[] }>;
}

export interface FrecencyStore {
  /** Return hit timestamps (ms epoch) for a log — empty if unknown. */
  hitsFor(logId: string): number[];
  /** Record a fired hit (now) for a log; oldest over cap drops. */
  record(logId: string, nowMs?: number): void;
  /** Drop any entries for log ids no longer in the provided set. */
  prune(knownLogIds: ReadonlySet<string>): void;
  /**
   * Compute the frecency score for a log at the provided reference time.
   * Returns 0 when the log has no recorded hits; higher is more-used.
   */
  score(logId: string, nowMs?: number): number;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readStore(): StoreShape {
  try {
    const raw = typeof localStorage !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw) as Partial<StoreShape> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.entries !== "object" || parsed.entries === null) {
      return { version: 1, entries: {} };
    }
    // Defensive shape check — if someone stored junk under the key, fall
    // through rather than throwing and breaking the whole palette.
    return { version: 1, entries: parsed.entries as Record<string, { hits: number[] }> };
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeStore(store: StoreShape): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // QuotaExceeded, privacy mode, etc. — give up silently. Frecency is a
    // nice-to-have; losing writes degrades to `last_logged_at` ordering.
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreHits(hits: number[], nowMs: number): number {
  let s = 0;
  for (const t of hits) {
    s += Math.exp(-(nowMs - t) / HALF_LIFE_MS);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePaletteFrecency(): FrecencyStore {
  // The store is stateless from React's perspective — all state lives in
  // localStorage, reads are lazy per call, writes invalidate immediately.
  // A single memoized object is enough to keep callback identity stable.
  return useMemo<FrecencyStore>(
    () => ({
      hitsFor(logId) {
        const store = readStore();
        return store.entries[logId]?.hits ?? [];
      },
      record(logId, nowMs = Date.now()) {
        const store = readStore();
        const existing = store.entries[logId]?.hits ?? [];
        const next = [...existing, nowMs];
        if (next.length > HITS_PER_LOG_CAP) {
          next.splice(0, next.length - HITS_PER_LOG_CAP);
        }
        store.entries[logId] = { hits: next };
        writeStore(store);
      },
      prune(knownLogIds) {
        const store = readStore();
        let changed = false;
        for (const id of Object.keys(store.entries)) {
          if (!knownLogIds.has(id)) {
            delete store.entries[id];
            changed = true;
          }
        }
        if (changed) writeStore(store);
      },
      score(logId, nowMs = Date.now()) {
        const store = readStore();
        const hits = store.entries[logId]?.hits ?? [];
        return scoreHits(hits, nowMs);
      },
    }),
    [],
  );
}
