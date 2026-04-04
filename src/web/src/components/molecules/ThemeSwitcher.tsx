/**
 * ThemeSwitcher molecule -- cycles through available themes.
 *
 * Displays the current theme name with an icon and cycles to the next
 * theme on click. Uses Button-like styling via theme tokens.
 */
import { useTheme, themes } from "../theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEME_NAMES = Object.keys(themes);
const THEME_LABELS: Record<string, string> = { deepTeal: "Teal", ember: "Ember" };
const THEME_ICONS: Record<string, string> = { deepTeal: "\u25C9", ember: "\u2666" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeSwitcherProps {
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThemeSwitcher({ style }: ThemeSwitcherProps) {
  const { theme, themeName, setTheme } = useTheme();

  function cycleTheme() {
    const idx = THEME_NAMES.indexOf(themeName);
    setTheme(THEME_NAMES[(idx + 1) % THEME_NAMES.length]);
  }

  const label = THEME_LABELS[themeName] ?? themeName;
  const icon = THEME_ICONS[themeName] ?? "\u25CE";

  return (
    <button
      style={{
        fontSize: theme.font.size.xs,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        background: theme.color.surface,
        color: theme.color.textMuted,
        fontFamily: theme.font.body,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.xs,
        transition: `all ${theme.motion.fast} ${theme.motion.easing}`,
        ...style,
      }}
      onClick={cycleTheme}
      title={`Theme: ${label}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
