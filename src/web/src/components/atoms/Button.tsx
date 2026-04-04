/**
 * Button atom -- primary action button with variants, sizes, and loading state.
 *
 * Replaces the duplicated button styles (addBtn, cancelBtn, submitBtn, saveBtn,
 * doneBtn, markDoneBtn, dangerBtn, link) found across page files.
 */
import { useState } from "react";
import { useTheme } from "../theme";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "icon";
  size?: "sm" | "md";
  loading?: boolean;
  style?: React.CSSProperties;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: theme.color.primaryContainer,
      color: theme.color.onPrimaryContainer,
      border: `1px solid ${theme.glow.borderStrong}`,
      boxShadow: theme.glow.animated
        ? `0 0 12px ${theme.glow.borderMedium}, inset 0 0 12px ${theme.glow.borderSubtle}`
        : "none",
    },
    ghost: {
      background: "transparent",
      color: theme.color.textMuted,
      border: `1px solid ${theme.color.borderSubtle}`,
    },
    danger: {
      background: `${theme.color.danger}22`,
      color: theme.color.danger,
      border: `1px solid ${theme.color.danger}44`,
    },
    icon: {
      background: "transparent",
      color: theme.color.textMuted,
      border: "1px solid transparent",
      padding: theme.spacing.xs,
    },
  };

  const hoverGlow: React.CSSProperties =
    hovered && !disabled && !loading && variant === "primary" && theme.glow.animated
      ? { boxShadow: theme.glow.hoverShadow, borderColor: theme.glow.borderStrong }
      : {};

  const isDisabled = disabled || loading;

  return (
    <button
      style={{
        padding:
          variant === "icon"
            ? theme.spacing.xs
            : size === "sm"
              ? `${theme.spacing.xs} ${theme.spacing.sm}`
              : `${theme.spacing.sm} ${theme.spacing.lg}`,
        borderRadius: theme.radius.lg,
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.body,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: `all ${theme.motion.fast} ${theme.motion.easing}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xs,
        lineHeight: 1,
        ...variantStyles[variant],
        ...hoverGlow,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: theme.radius.full,
            animation: "spin 0.6s linear infinite",
          }}
        />
      ) : (
        children
      )}
    </button>
  );
}
