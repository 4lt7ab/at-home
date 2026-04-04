import type { Theme } from "../theme";

/**
 * Shared base style for form field elements (Input, Select, Textarea).
 * All visual values derived from theme tokens.
 */
export function baseFieldStyle(theme: Theme): React.CSSProperties {
  return {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.color.borderSubtle}`,
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.sm,
    outline: "none",
    background: theme.color.surfaceContainerHigh,
    color: theme.color.text,
    transition: "border-color 0.15s, box-shadow 0.2s",
  };
}
