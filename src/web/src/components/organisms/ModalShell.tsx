/**
 * ModalShell organism -- Overlay + centered panel with Escape key handling.
 * Replaces the duplicated overlay+modal patterns across pages.
 */
import { useEffect } from "react";
import { useTheme } from "../theme";
import { Overlay } from "../atoms";

export interface ModalShellProps {
  onClose: () => void;
  variant?: "default" | "danger";
  maxWidth?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ModalShell({
  onClose,
  variant = "default",
  maxWidth = 520,
  children,
  style,
}: ModalShellProps) {
  const { theme } = useTheme();

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isDanger = variant === "danger";

  return (
    <Overlay onClick={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: theme.spacing.xl,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: theme.color.surfaceContainer,
            borderRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            boxShadow: theme.shadow.lg,
            maxWidth,
            width: "100%",
            border: isDanger
              ? `1px solid ${theme.color.danger}44`
              : `1px solid ${theme.color.borderSubtle}`,
            ...(isDanger
              ? { boxShadow: `${theme.shadow.lg}, 0 0 20px ${theme.color.danger}22` }
              : {}),
            ...style,
          }}
        >
          {children}
        </div>
      </div>
    </Overlay>
  );
}
