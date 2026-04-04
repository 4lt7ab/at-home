/**
 * SectionHeading molecule -- section heading component.
 * Migrated from components/SectionHeading.tsx to use theme tokens instead of CSS variables.
 */
import { useTheme } from "../theme";

export type SectionHeadingVariant = "default" | "overlay";

interface SectionHeadingProps {
  children: React.ReactNode;
  count?: number;
  variant?: SectionHeadingVariant;
  style?: React.CSSProperties;
}

export function SectionHeading({ children, count, variant = "default", style }: SectionHeadingProps) {
  const { theme } = useTheme();

  const baseStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: theme.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 8,
  };

  const variantStyles: Record<SectionHeadingVariant, React.CSSProperties> = {
    default: { marginTop: 24 },
    overlay: { marginTop: 20 },
  };

  return (
    <h3
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
      {count !== undefined && ` (${count})`}
    </h3>
  );
}
