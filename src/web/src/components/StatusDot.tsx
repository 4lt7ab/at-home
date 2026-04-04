export const STATUS_DOT_COLORS: Record<string, string> = {
  active: "var(--color-success)",
  paused: "var(--color-warning)",
  done: "var(--color-text-faint)",
  archived: "var(--color-text-faintest)",
};

const DEFAULT_COLOR = "var(--color-text-faint)";

interface StatusDotProps {
  status: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function StatusDot({ status, size = 8, color, style }: StatusDotProps) {
  const bg = color ?? STATUS_DOT_COLORS[status] ?? DEFAULT_COLOR;

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
        transition: "background 0.15s ease",
        ...style,
      }}
    />
  );
}
