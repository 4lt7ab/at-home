/**
 * Badge atom -- variant-based colored badge with legacy backward compatibility.
 *
 * Migrated from the original components/Badge.tsx. Supports both:
 * - New variant-based API: `<Badge variant="active">text</Badge>`
 * - Legacy color/bg props: `<Badge color="..." bg="...">text</Badge>`
 *
 * The legacy form is kept for backward compatibility during migration.
 */
import { useTheme } from "../theme";
import type { Theme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant =
  | "active"
  | "paused"
  | "done"
  | "archived"
  | "area"
  | "effort"
  | "overdue"
  | "completion"
  | "recurrence"
  | "content"
  | "standalone"
  | "status"
  | "default";

export interface BadgeProps {
  variant?: BadgeVariant;
  /** @deprecated Use variant prop instead. Kept for backward compatibility. */
  color?: string;
  /** @deprecated Use variant prop instead. Kept for backward compatibility. */
  bg?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Variant color mapping
// ---------------------------------------------------------------------------

function variantColors(theme: Theme): Record<BadgeVariant, { color: string; bg: string }> {
  return {
    active: { color: theme.color.success, bg: `${theme.color.success}22` },
    paused: { color: theme.color.warning, bg: `${theme.color.warning}22` },
    done: { color: theme.color.textFaint, bg: theme.color.surfaceContainerHigh },
    archived: { color: theme.color.textFaint, bg: theme.color.surfaceContainerHigh },
    area: { color: theme.color.tertiary, bg: `${theme.color.tertiary}22` },
    effort: { color: theme.color.textMuted, bg: theme.color.surfaceContainerHigh },
    overdue: { color: theme.color.onPrimary, bg: theme.color.danger },
    completion: { color: theme.color.success, bg: `${theme.color.success}22` },
    recurrence: { color: theme.color.primary, bg: `${theme.color.primary}22` },
    content: { color: theme.color.textMuted, bg: theme.color.surfaceContainerHigh },
    standalone: { color: theme.color.primary, bg: `${theme.color.primary}22` },
    status: { color: theme.color.textMuted, bg: theme.color.surfaceContainerHigh },
    default: { color: theme.color.textMuted, bg: theme.color.surfaceContainerHigh },
  };
}

// ---------------------------------------------------------------------------
// Legacy badgeStyle function (kept for backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use `<Badge variant="...">` instead. */
export function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 6px",
    borderRadius: 4,
    color,
    background: bg,
    marginRight: 6,
    whiteSpace: "nowrap",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Badge({ variant, color, bg, children, style }: BadgeProps) {
  const { theme } = useTheme();

  // Legacy mode: color + bg provided directly
  if (color && bg && !variant) {
    return (
      <span style={{ ...badgeStyle(color, bg), ...style }}>
        {children}
      </span>
    );
  }

  // Variant mode (default to "default" if no variant or legacy props)
  const v = variant ?? "default";
  const colors = variantColors(theme)[v];

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 6px",
        borderRadius: theme.radius.md,
        color: colors.color,
        background: colors.bg,
        marginRight: 6,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
