/**
 * AnimatedList molecule -- renders a list of items with slide-in animation
 * for newly added items. Tracks previous IDs via ref.
 * Respects reduced motion preferences.
 */
import { useRef, useEffect } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export interface AnimatedListProps<T extends { id: string }> {
  items: T[];
  renderItem: (item: T, isNew: boolean) => React.ReactNode;
  style?: React.CSSProperties;
}

export function AnimatedList<T extends { id: string }>({
  items,
  renderItem,
  style,
}: AnimatedListProps<T>) {
  const reduced = useReducedMotion();
  const prevIdsRef = useRef(new Set<string>());

  useEffect(() => {
    prevIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  return (
    <div style={style}>
      {items.map((item) => {
        const isNew =
          !reduced &&
          prevIdsRef.current.size > 0 &&
          !prevIdsRef.current.has(item.id);
        return (
          <div
            key={item.id}
            style={
              isNew
                ? { animation: "slide-in-left 0.2s ease-out" }
                : undefined
            }
          >
            {renderItem(item, isNew)}
          </div>
        );
      })}
    </div>
  );
}
