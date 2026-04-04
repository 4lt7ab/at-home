/**
 * Card molecule -- container with variant-specific styling.
 *
 * Variants:
 * - default: bordered surface with subtle border
 * - flat: no border, no shadow
 * - elevated: surface with medium shadow
 * - live: animated border pulse via CSS custom property
 */
import { useState } from "react";
import { useTheme } from "../theme";

export interface CardProps {
  variant?: "default" | "flat" | "live" | "elevated";
  padding?: string;
  hover?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({
  variant = "default",
  padding,
  hover = false,
  children,
  style,
  onClick,
}: CardProps) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  const resolvedPadding = padding ?? theme.spacing.lg;

  const baseStyle: React.CSSProperties = {
    padding: resolvedPadding,
    borderRadius: theme.radius.lg,
    transition: `all ${theme.motion.fast} ${theme.motion.easing}`,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: theme.color.surfaceContainer,
      border: `1px solid ${theme.color.borderSubtle}`,
    },
    flat: {
      background: theme.color.surfaceContainer,
      border: "1px solid transparent",
    },
    elevated: {
      background: theme.color.surfaceContainer,
      border: `1px solid ${theme.color.borderSubtle}`,
      boxShadow: theme.shadow.md,
    },
    live: {
      background: theme.color.surfaceContainer,
      border: `1px solid ${theme.color.borderSubtle}`,
      ["--glow-color" as string]: `${theme.color.primary}33`,
      animation: "glow-pulse 2s ease-in-out infinite",
    },
  };

  const hoverStyle: React.CSSProperties =
    hover && hovered
      ? { boxShadow: theme.shadow.sm, transform: "translateY(-1px)" }
      : {};

  return (
    <div
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...hoverStyle,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={hover ? () => setHovered(true) : undefined}
      onMouseLeave={hover ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  );
}
