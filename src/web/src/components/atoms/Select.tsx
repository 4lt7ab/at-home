/**
 * Select atom -- dropdown select with optional label and focus glow.
 */
import { useState } from "react";
import { useTheme } from "../theme";
import { baseFieldStyle } from "./fieldUtils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  style?: React.CSSProperties;
}

export function Select({ label, style, children, onFocus, onBlur, ...props }: SelectProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const isAnimated = theme.glow.animated;

  const focusStyles: React.CSSProperties =
    isAnimated && focused
      ? { borderColor: theme.glow.borderStrong, boxShadow: theme.glow.focusRing }
      : isAnimated
        ? { borderColor: theme.glow.borderSubtle, boxShadow: theme.glow.shadowSm }
        : {};

  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  const select = (
    <select
      style={{ ...baseFieldStyle(theme), ...focusStyles, width: "100%", ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      {children}
    </select>
  );

  if (!label) return select;

  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: theme.font.size.xs,
          color: theme.color.textMuted,
          marginBottom: theme.spacing.xs,
          fontFamily: theme.font.body,
        }}
      >
        {label}
      </span>
      {select}
    </label>
  );
}
