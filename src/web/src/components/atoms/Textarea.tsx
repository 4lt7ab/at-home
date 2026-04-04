/**
 * Textarea atom -- multi-line text input with optional label and focus glow.
 */
import { useState } from "react";
import { useTheme } from "../theme";
import { baseFieldStyle } from "./fieldUtils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  style?: React.CSSProperties;
}

export function Textarea({ label, style, onFocus, onBlur, rows = 3, ...props }: TextareaProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const isAnimated = theme.glow.animated;

  const focusStyles: React.CSSProperties =
    isAnimated && focused
      ? { borderColor: theme.glow.borderStrong, boxShadow: theme.glow.focusRing }
      : isAnimated
        ? { borderColor: theme.glow.borderSubtle, boxShadow: theme.glow.shadowSm }
        : {};

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  const textarea = (
    <textarea
      rows={rows}
      style={{
        ...baseFieldStyle(theme),
        ...focusStyles,
        width: "100%",
        resize: "vertical" as const,
        ...style,
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );

  if (!label) return textarea;

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
      {textarea}
    </label>
  );
}
