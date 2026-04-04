/**
 * DetailPageLayout template -- single column, max-width constrained, expandable.
 */
import { useTheme } from "../theme";

export interface DetailPageLayoutProps {
  children: React.ReactNode;
  expanded?: boolean;
  style?: React.CSSProperties;
}

export function DetailPageLayout({
  children,
  expanded = false,
  style,
}: DetailPageLayoutProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        maxWidth: expanded ? 1800 : 900,
        margin: "0 auto",
        padding: theme.spacing.xl,
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
