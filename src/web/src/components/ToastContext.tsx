import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { Toast } from "./Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  /** Whether the toast is animating out (used for exit animation). */
  exiting?: boolean;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

// ---------------------------------------------------------------------------
// Auto-dismiss durations (ms) by type
// ---------------------------------------------------------------------------

const DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 6000,
  info: 4000,
  warning: 5000,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// ToastProvider
// ---------------------------------------------------------------------------

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    // Clear the auto-dismiss timer if it exists
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    // Mark as exiting for animation, then remove after animation completes
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200); // match animation duration
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);

      const timer = setTimeout(() => {
        timers.current.delete(id);
        dismissToast(id);
      }, DURATION[type]);

      timers.current.set(id, timer);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// useToastContext hook
// ---------------------------------------------------------------------------

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used within a ToastProvider");
  return ctx;
}
