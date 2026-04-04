/**
 * ListPageLayout template -- constrains content to maxContentWidth, centered with padding.
 */
import { useTheme } from "../theme";

export interface ListPageLayoutProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ListPageLayout({ children, style }: ListPageLayoutProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        maxWidth: theme.layout.maxContentWidth,
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
