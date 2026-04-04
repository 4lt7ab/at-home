/**
 * Stack molecule -- thin flexbox wrapper with direction, gap, and alignment props.
 */
import { useTheme } from "../theme";
import type { Theme } from "../theme";

export interface StackProps {
  direction?: "row" | "column";
  gap?: keyof Theme["spacing"] | number;
  align?: React.CSSProperties["alignItems"];
  justify?: React.CSSProperties["justifyContent"];
  wrap?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Stack({
  direction = "column",
  gap = "md",
  align,
  justify,
  wrap,
  children,
  style,
}: StackProps) {
  const { theme } = useTheme();

  const resolvedGap =
    typeof gap === "number" ? gap : theme.spacing[gap] ?? gap;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: resolvedGap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
