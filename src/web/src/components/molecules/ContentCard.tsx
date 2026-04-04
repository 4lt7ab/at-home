/**
 * ContentCard molecule -- card wrapper with variant-specific left-border accent.
 * Migrated from components/ContentCard.tsx to use theme tokens instead of CSS variables.
 */
import { useTheme } from "../theme";

export type ContentCardVariant = "note" | "completion-note" | "schedule" | "history" | "default";

interface ContentCardProps {
  variant?: ContentCardVariant;
  compact?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ContentCard({ variant = "default", compact, children, style }: ContentCardProps) {
  const { theme } = useTheme();

  const baseStyle: React.CSSProperties = {
    padding: "10px 12px",
    marginBottom: compact ? 0 : 6,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.borderSubtle}`,
    fontSize: 13,
  };

  const variantStyles: Record<ContentCardVariant, React.CSSProperties> = {
    note: {
      borderLeft: `3px solid ${theme.color.primary}`,
      background: theme.color.surfaceContainer,
    },
    "completion-note": {
      borderLeft: `3px solid ${theme.color.success}`,
      background: `${theme.color.success}15`,
    },
    schedule: {
      borderLeft: `3px solid ${theme.color.tertiary}`,
      background: theme.color.surfaceContainer,
    },
    history: {
      background: theme.color.surfaceContainer,
      color: theme.color.textMuted,
    },
    default: {
      background: theme.color.surfaceContainer,
      border: `1px solid ${theme.color.borderSubtle}`,
    },
  };

  return (
    <div
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
