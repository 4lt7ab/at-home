/**
 * Input atom -- text input with optional label and focus glow.
 */
import { useState } from "react";
import { useTheme } from "../theme";
import { baseFieldStyle } from "./fieldUtils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  style?: React.CSSProperties;
}

export function Input({ label, style, onFocus, onBlur, ...props }: InputProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const isAnimated = theme.glow.animated;

  const focusStyles: React.CSSProperties =
    isAnimated && focused
      ? { borderColor: theme.glow.borderStrong, boxShadow: theme.glow.focusRing }
      : isAnimated
        ? { borderColor: theme.glow.borderSubtle, boxShadow: theme.glow.shadowSm }
        : {};

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  const input = (
    <input
      style={{ ...baseFieldStyle(theme), ...focusStyles, width: "100%", ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );

  if (!label) return input;

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
      {input}
    </label>
  );
}
