/**
 * SectionLabel atom -- uppercase micro-label for section headings.
 */
import { useTheme } from "../theme";

export interface SectionLabelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  const { theme } = useTheme();

  return (
    <span
      style={{
        fontSize: theme.font.size.xxs,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: theme.font.letterSpacing.wide,
        color: theme.color.textFaint,
        fontFamily: theme.font.body,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
