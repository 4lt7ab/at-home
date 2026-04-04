/**
 * ConfirmDialog organism -- ModalShell with title, message, and confirm/cancel buttons.
 * Manages async loading state during the confirm action.
 */
import { useState, useCallback } from "react";
import { useTheme } from "../theme";
import { Button } from "../atoms";
import { ModalShell } from "./ModalShell";

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onClose,
  loading: externalLoading,
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading ?? internalLoading;

  const handleConfirm = useCallback(async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }, [onConfirm]);

  return (
    <ModalShell onClose={onClose} variant={variant} maxWidth={420}>
      <h2
        style={{
          margin: 0,
          fontSize: theme.font.size.lg,
          fontWeight: 600,
          color: theme.color.text,
          fontFamily: theme.font.headline,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: `${theme.spacing.md} 0 ${theme.spacing.xl}`,
          fontSize: theme.font.size.sm,
          color: theme.color.textMuted,
          lineHeight: theme.font.lineHeight.normal,
        }}
      >
        {message}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: theme.spacing.sm }}>
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          onClick={handleConfirm}
          loading={isLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}
