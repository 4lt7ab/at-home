export type DomainEvent =
  | { type: 'created'; entity_type: string; payload: unknown }
  | { type: 'updated'; entity_type: string; payload: unknown }
  | { type: 'deleted'; entity_type: string; ids: string[] };

type Listener = (event: DomainEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();
  private buffering = false;
  private buffer: DomainEvent[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event: DomainEvent): void {
    if (this.buffering) {
      this.buffer.push(event);
      return;
    }
    this.broadcast(event);
  }

  /** Begin buffering — emit() queues events instead of broadcasting. */
  startBuffer(): void {
    this.buffering = true;
    this.buffer = [];
  }

  /** Deliver all buffered events to listeners in order, then stop buffering. */
  flush(): void {
    const events = this.buffer;
    this.buffering = false;
    this.buffer = [];
    for (const event of events) {
      this.broadcast(event);
    }
  }

  /** Discard all buffered events without delivering, then stop buffering. */
  discard(): void {
    this.buffering = false;
    this.buffer = [];
  }

  private broadcast(event: DomainEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // listener errors must not break the emitter
      }
    }
  }
}
