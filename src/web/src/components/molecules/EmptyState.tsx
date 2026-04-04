/**
 * EmptyState molecule -- centered icon + message for zero-data states.
 */
import { useTheme } from "../theme";
import { Icon } from "../atoms";
import { Card } from "./Card";

export interface EmptyStateProps {
  icon?: string;
  message: string;
  variant?: "plain" | "card";
  style?: React.CSSProperties;
}

export function EmptyState({
  icon,
  message,
  variant = "plain",
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
        color: theme.color.textMuted,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={32} style={{ opacity: 0.5 }} />}
      <span
        style={{
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.body,
          textAlign: "center",
        }}
      >
        {message}
      </span>
    </div>
  );

  if (variant === "card") {
    return <Card>{content}</Card>;
  }

  return content;
}
