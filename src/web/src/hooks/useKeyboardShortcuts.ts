import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutRegistration {
  keys: string;
  description: string;
  scope: string;
  callback: () => void;
}

export interface ShortcutEntry {
  keys: string;
  description: string;
  scope: string;
}

// ---------------------------------------------------------------------------
// Singleton shortcut registry
// ---------------------------------------------------------------------------

const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const SEQUENCE_TIMEOUT_MS = 800;

/** Internal registration with stable id for dedup */
interface InternalRegistration {
  id: number;
  keys: string;
  description: string;
  scope: string;
  callbackRef: { current: () => void };
}

let nextId = 0;
const registrations = new Map<number, InternalRegistration>();
let suppressionCount = 0;
let pendingFirstKey: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let listenerAttached = false;
let snapshotVersion = 0;
let cachedSnapshot: ShortcutEntry[] = [];

// External store subscribers (for useRegisteredShortcuts)
const subscribers = new Set<() => void>();

function notifySubscribers() {
  snapshotVersion++;
  cachedSnapshot = buildSnapshot();
  for (const fn of subscribers) fn();
}

function buildSnapshot(): ShortcutEntry[] {
  const seen = new Set<string>();
  const entries: ShortcutEntry[] = [];
  for (const reg of registrations.values()) {
    // Deduplicate by keys+scope (same shortcut registered by multiple instances)
    const dedup = `${reg.keys}::${reg.scope}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    entries.push({ keys: reg.keys, description: reg.description, scope: reg.scope });
  }
  // Sort by scope then keys for stable ordering
  entries.sort((a, b) => a.scope.localeCompare(b.scope) || a.keys.localeCompare(b.keys));
  return entries;
}

function getSnapshot(): ShortcutEntry[] {
  return cachedSnapshot;
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// Key matching
// ---------------------------------------------------------------------------

function normalizeKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  // Normalize the key itself
  const key = e.key.toLowerCase();
  // Don't include modifier keys as the key portion
  if (!["control", "meta", "alt", "shift"].includes(key)) {
    parts.push(key);
  }
  return parts.join("+");
}

function parseShortcutKeys(keys: string): string[][] {
  // "g h" => two-key sequence: [["g"], ["h"]]
  // "ctrl+s" => single combo: [["ctrl+s"]]
  // "shift+g" => single combo: [["shift+g"]]
  // "?" => single key: [["?"]]
  return keys
    .trim()
    .split(/\s+/)
    .map((part) => [part.toLowerCase()]);
}

function matchesKeyCombo(combo: string, normalizedEvent: string): boolean {
  // Parse the combo string (e.g., "ctrl+s", "shift+g", "g", "?", "escape")
  return combo === normalizedEvent;
}

// ---------------------------------------------------------------------------
// Global keydown handler
// ---------------------------------------------------------------------------

function handleKeyDown(e: KeyboardEvent) {
  // Skip when focused in form elements
  const target = e.target as HTMLElement | null;
  if (target && IGNORED_TAGS.has(target.tagName)) return;
  if (target && target.isContentEditable) return;

  // Skip when suppressed (modals/overlays open)
  if (suppressionCount > 0) return;

  const normalized = normalizeKeyEvent(e);
  // Ignore pure modifier presses
  if (normalized === "") return;

  // Check for two-key sequences
  if (pendingFirstKey !== null) {
    // We're in the middle of a sequence
    const savedFirst = pendingFirstKey;
    clearPendingSequence();
    const sequenceKey = `${savedFirst} ${normalized}`;

    for (const reg of registrations.values()) {
      const parsed = parseShortcutKeys(reg.keys);
      if (parsed.length === 2) {
        const fullSequence = `${parsed[0][0]} ${parsed[1][0]}`;
        if (fullSequence === sequenceKey) {
          e.preventDefault();
          reg.callbackRef.current();
          return;
        }
      }
    }
    // No sequence matched -- fall through to check single-key shortcuts
    // with the current key
  }

  // Check single-key shortcuts
  for (const reg of registrations.values()) {
    const parsed = parseShortcutKeys(reg.keys);
    if (parsed.length === 1) {
      if (matchesKeyCombo(parsed[0][0], normalized)) {
        e.preventDefault();
        reg.callbackRef.current();
        clearPendingSequence();
        return;
      }
    }
  }

  // Check if this key could be the start of a sequence
  for (const reg of registrations.values()) {
    const parsed = parseShortcutKeys(reg.keys);
    if (parsed.length === 2 && parsed[0][0] === normalized) {
      // Don't preventDefault here -- it might not complete the sequence
      pendingFirstKey = normalized;
      pendingTimer = setTimeout(() => {
        clearPendingSequence();
      }, SEQUENCE_TIMEOUT_MS);
      return;
    }
  }
}

function clearPendingSequence() {
  pendingFirstKey = null;
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function ensureListener() {
  if (listenerAttached) return;
  window.addEventListener("keydown", handleKeyDown);
  listenerAttached = true;
}

function maybeRemoveListener() {
  if (registrations.size === 0 && listenerAttached) {
    window.removeEventListener("keydown", handleKeyDown);
    listenerAttached = false;
  }
}

// ---------------------------------------------------------------------------
// Registration API
// ---------------------------------------------------------------------------

function register(reg: InternalRegistration): () => void {
  registrations.set(reg.id, reg);
  ensureListener();
  notifySubscribers();
  return () => {
    registrations.delete(reg.id);
    maybeRemoveListener();
    notifySubscribers();
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Register a keyboard shortcut.
 *
 * @param keys - Key combo string. Examples: "?", "escape", "shift+g", "ctrl+s", "g h" (two-key sequence)
 * @param description - Human-readable description for the help overlay
 * @param callback - Function to call when the shortcut fires
 * @param scope - Grouping label for the help overlay (e.g., "Navigation", "Actions")
 */
export function useShortcut(
  keys: string,
  description: string,
  callback: () => void,
  scope: string = "General",
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
    idRef.current = nextId++;
  }

  useEffect(() => {
    const reg: InternalRegistration = {
      id: idRef.current!,
      keys,
      description,
      scope,
      callbackRef,
    };
    const unregister = register(reg);
    return unregister;
  }, [keys, description, scope]);
}

/**
 * Suppress all shortcut firing while `isActive` is true.
 * Uses a ref-counter so multiple overlapping suppressors work correctly.
 */
export function useShortcutSuppression(isActive: boolean): void {
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      suppressionCount++;
      wasActiveRef.current = true;
    } else if (!isActive && wasActiveRef.current) {
      suppressionCount = Math.max(0, suppressionCount - 1);
      wasActiveRef.current = false;
    }

    return () => {
      if (wasActiveRef.current) {
        suppressionCount = Math.max(0, suppressionCount - 1);
        wasActiveRef.current = false;
      }
    };
  }, [isActive]);
}

/**
 * Returns all currently registered shortcuts, grouped by scope.
 * Re-renders when registrations change.
 */
export function useRegisteredShortcuts(): Map<string, ShortcutEntry[]> {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Group by scope -- we use useRef+comparison to keep a stable reference
  const groupedRef = useRef<Map<string, ShortcutEntry[]>>(new Map());
  const lastEntriesRef = useRef<ShortcutEntry[]>([]);

  if (entries !== lastEntriesRef.current) {
    lastEntriesRef.current = entries;
    const grouped = new Map<string, ShortcutEntry[]>();
    for (const entry of entries) {
      const group = grouped.get(entry.scope) ?? [];
      group.push(entry);
      grouped.set(entry.scope, group);
    }
    groupedRef.current = grouped;
  }

  return groupedRef.current;
}

// ---------------------------------------------------------------------------
// Testing helpers (exported for test access only)
// ---------------------------------------------------------------------------

/** Reset all state -- for testing only */
export function _resetShortcutManager(): void {
  registrations.clear();
  suppressionCount = 0;
  clearPendingSequence();
  if (listenerAttached) {
    window.removeEventListener("keydown", handleKeyDown);
    listenerAttached = false;
  }
  snapshotVersion = 0;
  cachedSnapshot = [];
  subscribers.clear();
  nextId = 0;
}

/** Get current suppression count -- for testing only */
export function _getSuppressionCount(): number {
  return suppressionCount;
}
