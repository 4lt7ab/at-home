import { useTheme } from "./theme";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { ToastItem, ToastType } from "./ToastContext";

// ---------------------------------------------------------------------------
// Icon lookup by toast type
// ---------------------------------------------------------------------------

const ICON_NAME: Record<ToastType, string> = {
  success: "check_circle",
  error: "error_outline",
  info: "info",
  warning: "warning",
};

// ---------------------------------------------------------------------------
// Toast container + items
// ---------------------------------------------------------------------------

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  const { theme } = useTheme();

  if (toasts.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.sm,
    zIndex: 9999,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual toast item
// ---------------------------------------------------------------------------

interface ToastItemProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();

  const colorByType: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: {
      bg: `${theme.color.success}22`,
      border: `${theme.color.success}66`,
      text: theme.color.success,
    },
    error: {
      bg: `${theme.color.danger}22`,
      border: `${theme.color.danger}66`,
      text: theme.color.danger,
    },
    info: {
      bg: `${theme.color.primary}22`,
      border: `${theme.color.primary}66`,
      text: theme.color.primary,
    },
    warning: {
      bg: `${theme.color.warning}22`,
      border: `${theme.color.warning}66`,
      text: theme.color.warning,
    },
  };

  const colors = colorByType[toast.type];

  const animation = reduced
    ? undefined
    : toast.exiting
      ? "toast-out 0.2s ease-in forwards"
      : "toast-in 0.2s ease-out";

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.sm,
    color: theme.color.text,
    boxShadow: theme.shadow.md,
    cursor: "pointer",
    pointerEvents: "auto",
    maxWidth: "400px",
    animation,
  };

  const iconStyle: React.CSSProperties = {
    color: colors.text,
    fontSize: "18px",
    flexShrink: 0,
  };

  return (
    <div
      style={itemStyle}
      onClick={() => onDismiss(toast.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss(toast.id);
      }}
    >
      <span className="material-symbols-outlined" style={iconStyle}>
        {ICON_NAME[toast.type]}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
}
