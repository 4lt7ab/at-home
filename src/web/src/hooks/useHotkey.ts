import { useEffect, useRef } from "react";

interface HotkeyModifiers {
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
}

const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Registers a global keydown listener for the given key + modifier combination.
 * Ignores events originating from input/textarea/select elements to avoid
 * accidental triggers while typing in forms.
 */
export function useHotkey(
  key: string,
  modifiers: HotkeyModifiers,
  callback: () => void,
): void {
  // Keep callback ref fresh without re-registering the listener
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when focus is in a form element
      const target = e.target as HTMLElement | null;
      if (target && IGNORED_TAGS.has(target.tagName)) return;
      // Also skip contentEditable elements
      if (target && target.isContentEditable) return;

      // Check modifiers
      if (!!modifiers.ctrl !== e.ctrlKey) return;
      if (!!modifiers.shift !== e.shiftKey) return;
      if (!!modifiers.meta !== e.metaKey) return;
      if (!!modifiers.alt !== e.altKey) return;

      // Check key (case-insensitive comparison)
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      e.preventDefault();
      callbackRef.current();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, modifiers.ctrl, modifiers.shift, modifiers.meta, modifiers.alt]);
}
