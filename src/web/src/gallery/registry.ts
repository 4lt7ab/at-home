/**
 * Component gallery registry -- interfaces and registration functions.
 *
 * Provides a simple registry for component entries with prop definitions,
 * render functions, and variant lists. Includes a lazy initialization guard
 * to prevent double registration.
 */
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropDef {
  name: string;
  type: "string" | "enum" | "boolean" | "number";
  defaultValue: string | boolean | number;
  options?: string[];
  description?: string;
}

export interface ComponentEntry {
  name: string;
  description: string;
  category: "atom" | "molecule" | "organism" | "template";
  propDefs: PropDef[];
  render: (props: Record<string, unknown>) => ReactNode;
  variants?: { name: string; props: Record<string, unknown> }[];
  codeTemplate?: string;
}

// ---------------------------------------------------------------------------
// Registry state
// ---------------------------------------------------------------------------

const registry = new Map<string, ComponentEntry>();
let initialized = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function registerComponent(entry: ComponentEntry): void {
  registry.set(entry.name, entry);
}

export function getComponents(): ComponentEntry[] {
  return Array.from(registry.values());
}

export function getComponent(name: string): ComponentEntry | undefined {
  return registry.get(name);
}

export function getComponentsByCategory(category: ComponentEntry["category"]): ComponentEntry[] {
  return getComponents().filter((c) => c.category === category);
}

/**
 * Lazy initialization guard -- prevents double registration when the gallery
 * module is re-imported or hot-reloaded during development.
 */
export function ensureRegistered(register: () => void): void {
  if (initialized) return;
  initialized = true;
  register();
}

/**
 * Reset the registry (for testing only).
 */
export function resetRegistry(): void {
  registry.clear();
  initialized = false;
}
