/**
 * CreateEntityOverlay organism -- base form overlay using ModalShell.
 * Provides shell + submit/cancel buttons; all form fields come via children.
 */
import { useTheme } from "../theme";
import { Button } from "../atoms";
import { ModalShell } from "./ModalShell";

export interface CreateEntityOverlayProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function CreateEntityOverlay({
  title,
  onClose,
  onSubmit,
  loading = false,
  submitLabel = "Create",
  children,
  style,
}: CreateEntityOverlayProps) {
  const { theme } = useTheme();

  return (
    <ModalShell onClose={onClose} style={style}>
      <h2
        style={{
          margin: 0,
          fontSize: theme.font.size.lg,
          fontWeight: 600,
          color: theme.color.text,
          fontFamily: theme.font.headline,
          marginBottom: theme.spacing.lg,
        }}
      >
        {title}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        {children}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xl,
        }}
      >
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSubmit} loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </ModalShell>
  );
}
