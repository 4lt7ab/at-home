import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { DomainEvent } from "../useRealtimeEvents";

export type SubscribeEvents = (fn: (e: DomainEvent) => void) => () => void;

export interface EventSubscriptionContextValue {
  subscribeEvents: SubscribeEvents;
  connected: boolean;
}

export const EventSubscriptionContext = createContext<EventSubscriptionContextValue | null>(null);

export function useEventSubscription(): EventSubscriptionContextValue {
  const ctx = useContext(EventSubscriptionContext);
  if (!ctx) throw new Error("useEventSubscription must be used within an EventSubscriptionProvider");
  return ctx;
}

/**
 * Hook to create the fan-out subscription system.
 * Used once in App to wire up the single WebSocket connection.
 */
export function useEventFanOut() {
  const eventListenersRef = useRef(new Set<(e: DomainEvent) => void>());

  const onEvent = useCallback((event: DomainEvent) => {
    for (const fn of eventListenersRef.current) fn(event);
  }, []);

  const subscribeEvents: SubscribeEvents = useCallback((fn: (e: DomainEvent) => void) => {
    eventListenersRef.current.add(fn);
    return () => { eventListenersRef.current.delete(fn); };
  }, []);

  return { onEvent, subscribeEvents };
}

/**
 * Subscribe to domain events matching specific entity types.
 * Automatically unsubscribes on unmount.
 */
export function useEntitySubscription(
  entityTypes: string[],
  callback: () => void,
): void {
  const { subscribeEvents } = useEventSubscription();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return subscribeEvents((event) => {
      if (entityTypes.includes(event.entity_type)) {
        callbackRef.current();
      }
    });
  }, [subscribeEvents, ...entityTypes]); // eslint-disable-line react-hooks/exhaustive-deps
}
