import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeEvents } from "./useRealtimeEvents";
import type { DomainEvent } from "./useRealtimeEvents";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0; // CONNECTING
  url: string;
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }

  simulateError() {
    this.onerror?.();
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.WebSocket = originalWebSocket;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useRealtimeEvents", () => {
  it("creates WebSocket with correct URL (ws:// based on location.protocol)", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));
    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe(`ws://${location.host}/ws`);
  });

  it("sets connected to true on ws.onopen", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useRealtimeEvents(onEvent));
    expect(result.current.connected).toBe(false);

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    expect(result.current.connected).toBe(true);
  });

  it("sets connected to false on ws.onclose", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useRealtimeEvents(onEvent));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    expect(result.current.connected).toBe(false);
  });

  it("parses valid JSON messages and calls onEvent callback", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const event: DomainEvent = { type: "created", entity_type: "home_task" };
    act(() => {
      MockWebSocket.instances[0].simulateMessage(JSON.stringify(event));
    });

    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it("silently ignores malformed JSON messages", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // Should not throw
    act(() => {
      MockWebSocket.instances[0].simulateMessage("not valid json {{{");
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("reconnects on close with exponential backoff (1s, 2s, 4s)", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));
    expect(MockWebSocket.instances).toHaveLength(1);

    // Close -> reconnect after 1s (2^0 * 1000)
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    expect(MockWebSocket.instances).toHaveLength(1); // not yet reconnected

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Close again -> reconnect after 2s (2^1 * 1000)
    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(MockWebSocket.instances).toHaveLength(2); // not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    // Close again -> reconnect after 4s (2^2 * 1000)
    act(() => {
      MockWebSocket.instances[2].simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(MockWebSocket.instances).toHaveLength(3); // not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it("caps reconnect delay at 30 seconds", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    // Simulate many disconnects to push attempt count high
    // After attempt >= 15, delay would be 2^15 * 1000 = 32768000 > 30000
    // We need to disconnect enough times. Let's go through attempts 0..15.
    for (let i = 0; i < 16; i++) {
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateClose();
      });
      const delay = Math.min(1000 * 2 ** i, 30000);
      act(() => {
        vi.advanceTimersByTime(delay);
      });
    }

    const instancesBefore = MockWebSocket.instances.length;

    // Now close again. Delay should be capped at 30s, not 2^16 * 1000 = 65536s
    act(() => {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(MockWebSocket.instances).toHaveLength(instancesBefore + 1);
  });

  it("resets attempt counter to 0 on successful reconnect", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    // Close -> wait 1s -> reconnect
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Close again -> wait 2s -> reconnect
    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    // Open this one (resets attempt to 0)
    act(() => {
      MockWebSocket.instances[2].simulateOpen();
    });

    // Close -> next delay should be 1s again (attempt reset to 0)
    act(() => {
      MockWebSocket.instances[2].simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockWebSocket.instances).toHaveLength(3); // not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it("closes WebSocket and clears reconnect timer on unmount", () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRealtimeEvents(onEvent));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    // Close to start reconnect timer
    act(() => {
      ws.simulateClose();
    });

    const instancesBefore = MockWebSocket.instances.length;

    // Unmount should clear the reconnect timer
    unmount();

    // Advance past the reconnect delay -- no new WebSocket should be created
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // The close() on unmount creates a new close call, but no new WS instances
    // after the unmount cleanup runs
    expect(MockWebSocket.instances).toHaveLength(instancesBefore);
  });

  it("ws.onerror triggers ws.close()", () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    act(() => {
      ws.simulateError();
    });

    expect(ws.close).toHaveBeenCalled();
  });

  it("uses latest onEvent callback via ref (no stale closure)", () => {
    const onEvent1 = vi.fn();
    const onEvent2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useRealtimeEvents(cb),
      { initialProps: { cb: onEvent1 } },
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // Rerender with a new callback
    rerender({ cb: onEvent2 });

    const event: DomainEvent = { type: "updated", entity_type: "note" };
    act(() => {
      MockWebSocket.instances[0].simulateMessage(JSON.stringify(event));
    });

    expect(onEvent1).not.toHaveBeenCalled();
    expect(onEvent2).toHaveBeenCalledWith(event);
  });
});
