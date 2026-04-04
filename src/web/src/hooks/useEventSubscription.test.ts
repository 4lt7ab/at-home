import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  useEventFanOut,
  EventSubscriptionContext,
  useEventSubscription,
  useEntitySubscription,
} from "./useEventSubscription";
import type { DomainEvent } from "../useRealtimeEvents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(entity_type: string, type: DomainEvent["type"] = "created"): DomainEvent {
  return { type, entity_type };
}

// ---------------------------------------------------------------------------
// useEventFanOut
// ---------------------------------------------------------------------------

describe("useEventFanOut", () => {
  it("onEvent dispatches to all registered subscribers", () => {
    const { result } = renderHook(() => useEventFanOut());
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    act(() => {
      result.current.subscribeEvents(listener1);
      result.current.subscribeEvents(listener2);
    });

    const event = makeEvent("home_task");
    act(() => {
      result.current.onEvent(event);
    });

    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it("subscribeEvents returns an unsubscribe function that removes the listener", () => {
    const { result } = renderHook(() => useEventFanOut());
    const listener = vi.fn();

    let unsub: () => void;
    act(() => {
      unsub = result.current.subscribeEvents(listener);
    });

    act(() => {
      unsub();
    });

    act(() => {
      result.current.onEvent(makeEvent("home_task"));
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("multiple subscribers receive the same event", () => {
    const { result } = renderHook(() => useEventFanOut());
    const listeners = [vi.fn(), vi.fn(), vi.fn()];

    act(() => {
      listeners.forEach((l) => result.current.subscribeEvents(l));
    });

    const event = makeEvent("note", "updated");
    act(() => {
      result.current.onEvent(event);
    });

    listeners.forEach((l) => {
      expect(l).toHaveBeenCalledTimes(1);
      expect(l).toHaveBeenCalledWith(event);
    });
  });

  it("unsubscribed listeners do not receive subsequent events", () => {
    const { result } = renderHook(() => useEventFanOut());
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    let unsub1: () => void;
    act(() => {
      unsub1 = result.current.subscribeEvents(listener1);
      result.current.subscribeEvents(listener2);
    });

    act(() => {
      unsub1();
    });

    act(() => {
      result.current.onEvent(makeEvent("schedule"));
    });

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useEventSubscription (context hook)
// ---------------------------------------------------------------------------

describe("useEventSubscription", () => {
  it("throws error when used outside EventSubscriptionContext provider", () => {
    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useEventSubscription());
    }).toThrow("useEventSubscription must be used within an EventSubscriptionProvider");
    consoleSpy.mockRestore();
  });

  it("returns context value when inside provider", () => {
    const mockValue = {
      subscribeEvents: vi.fn(() => () => {}),
      connected: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        EventSubscriptionContext.Provider,
        { value: mockValue },
        children,
      );

    const { result } = renderHook(() => useEventSubscription(), { wrapper });
    expect(result.current).toBe(mockValue);
  });
});

// ---------------------------------------------------------------------------
// useEntitySubscription
// ---------------------------------------------------------------------------

describe("useEntitySubscription", () => {
  function createWrapper() {
    let onEvent: ((e: DomainEvent) => void) | null = null;

    function Wrapper({ children }: { children: React.ReactNode }) {
      const fanOut = useEventFanOut();
      onEvent = fanOut.onEvent;
      return React.createElement(
        EventSubscriptionContext.Provider,
        { value: { subscribeEvents: fanOut.subscribeEvents, connected: true } },
        children,
      );
    }

    return { Wrapper, getOnEvent: () => onEvent! };
  }

  it("calls callback when event.entity_type matches subscribed types", () => {
    const { Wrapper, getOnEvent } = createWrapper();
    const callback = vi.fn();

    renderHook(() => useEntitySubscription(["home_task"], callback), {
      wrapper: Wrapper,
    });

    act(() => {
      getOnEvent()(makeEvent("home_task"));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not call callback for non-matching entity types", () => {
    const { Wrapper, getOnEvent } = createWrapper();
    const callback = vi.fn();

    renderHook(() => useEntitySubscription(["home_task"], callback), {
      wrapper: Wrapper,
    });

    act(() => {
      getOnEvent()(makeEvent("note"));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount (callback is no longer called after unmount)", () => {
    const { Wrapper, getOnEvent } = createWrapper();
    const callback = vi.fn();

    const { unmount } = renderHook(
      () => useEntitySubscription(["home_task"], callback),
      { wrapper: Wrapper },
    );

    unmount();

    act(() => {
      getOnEvent()(makeEvent("home_task"));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("tracks latest callback via ref (does not go stale)", () => {
    const { Wrapper, getOnEvent } = createWrapper();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useEntitySubscription(["home_task"], cb),
      {
        wrapper: Wrapper,
        initialProps: { cb: callback1 },
      },
    );

    rerender({ cb: callback2 });

    act(() => {
      getOnEvent()(makeEvent("home_task"));
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("subscribes to multiple entity types simultaneously", () => {
    const { Wrapper, getOnEvent } = createWrapper();
    const callback = vi.fn();

    renderHook(
      () => useEntitySubscription(["home_task", "schedule", "note"], callback),
      { wrapper: Wrapper },
    );

    act(() => {
      getOnEvent()(makeEvent("home_task"));
      getOnEvent()(makeEvent("schedule"));
      getOnEvent()(makeEvent("note"));
      getOnEvent()(makeEvent("other"));
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });
});
