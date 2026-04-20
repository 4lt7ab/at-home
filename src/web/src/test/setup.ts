import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mock localStorage (Node 22+ provides a broken built-in localStorage that
// overrides jsdom's implementation when --localstorage-file is not set)
// ---------------------------------------------------------------------------
{
  const store: Record<string, string> = {};
  const localStorageMock: Storage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true, configurable: true });
}

// ---------------------------------------------------------------------------
// Mock Element.prototype.scrollIntoView (jsdom does not implement it — the
// @4lt7ab/ui Combobox List calls it after arrow-key focus changes)
// ---------------------------------------------------------------------------
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    /* no-op for jsdom */
  };
}

// ---------------------------------------------------------------------------
// Mock window.matchMedia (needed by useTheme and any media-query-dependent code)
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
