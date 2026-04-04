/**
 * StatusDot atom -- small colored circle indicating entity status.
 *
 * Migrated from the original components/StatusDot.tsx.
 * Uses theme tokens instead of CSS variable strings.
 */
import { useTheme } from "../theme";
import type { Theme } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusDotProps {
  status: string;
  size?: number;
  color?: string;
  animate?: boolean;
  glowColor?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Status-to-color mapping via theme tokens
// ---------------------------------------------------------------------------

function getStatusColor(status: string, theme: Theme): string {
  const map: Record<string, string> = {
    active: theme.color.success,
    paused: theme.color.warning,
    done: theme.color.textFaint,
    archived: `${theme.color.textFaint}66`,
  };
  return map[status] ?? theme.color.textFaint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusDot({ status, size = 8, color, animate, glowColor, style }: StatusDotProps) {
  const { theme } = useTheme();
  const bg = color ?? getStatusColor(status, theme);

  const animateStyles: React.CSSProperties =
    animate && glowColor
      ? {
          ["--glow-color" as string]: glowColor,
          animation: "glow-pulse 2s ease-in-out infinite",
        }
      : {};

  return (
    <span
      title={status}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        flexShrink: 0,
        transition: `background ${theme.motion.fast} ${theme.motion.easing}`,
        ...animateStyles,
        ...style,
      }}
    />
  );
}
