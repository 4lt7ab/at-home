/**
 * TopBar organism -- sticky header with navigation and trailing content.
 * Extracted from App.tsx.
 */
import { useTheme } from "../theme";

export interface TopBarNavItem {
  label: string;
  path: string;
}

export interface TopBarProps {
  navItems: TopBarNavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}

export function TopBar({
  navItems,
  activePath,
  onNavigate,
  trailing,
  style,
}: TopBarProps) {
  const { theme } = useTheme();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: 48,
        borderBottom: `1px solid ${theme.color.border}`,
        background: theme.color.surface,
        position: "sticky" as const,
        top: 0,
        zIndex: 10,
        ...style,
      }}
    >
      <nav style={{ display: "flex", gap: 4 }}>
        {navItems.map((item) => {
          const active = activePath === item.path;
          return (
            <button
              key={item.path}
              style={{
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? theme.color.text : theme.color.textMuted,
                padding: "6px 12px",
                borderRadius: 6,
                background: active ? `${theme.color.primary}22` : "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                fontFamily: theme.font.body,
              }}
              onClick={() => onNavigate(item.path)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      {trailing && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{trailing}</div>}
    </header>
  );
}
