import { useState } from "react";
import { useTheme } from "../theme";
import { useShortcut, useRegisteredShortcuts, useShortcutSuppression } from "../../hooks/useKeyboardShortcuts";

// ---------------------------------------------------------------------------
// Key badge display helper
// ---------------------------------------------------------------------------

function formatKeys(keys: string): string[] {
  // "g h" => ["g", "h"]
  // "shift+g" => ["Shift", "G"]
  // "ctrl+s" => ["Ctrl", "S"]
  // "escape" => ["Esc"]
  const parts = keys.split(/\s+/);
  return parts.flatMap((part) => {
    const mods = part.split("+");
    return mods.map((m) => {
      switch (m) {
        case "ctrl":
          return "Ctrl";
        case "meta":
          return "Cmd";
        case "alt":
          return "Alt";
        case "shift":
          return "Shift";
        case "escape":
          return "Esc";
        default:
          return m.length === 1 ? m.toUpperCase() : m;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// ShortcutHelpOverlay
// ---------------------------------------------------------------------------

export function ShortcutHelpOverlay() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const grouped = useRegisteredShortcuts();

  useShortcut("?", "Show keyboard shortcuts", () => setOpen((v) => !v), "General");
  useShortcutSuppression(open);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: `${theme.color.surface}cc`,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const panelStyle: React.CSSProperties = {
    background: theme.color.surfaceContainer,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.xl,
    padding: theme.spacing["2xl"],
    maxWidth: 520,
    width: "90vw",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: theme.shadow.lg,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: theme.font.headline,
    fontSize: theme.font.size.lg,
    color: theme.color.text,
    marginBottom: theme.spacing.lg,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const scopeLabelStyle: React.CSSProperties = {
    fontFamily: theme.font.body,
    fontSize: theme.font.size.xxs,
    color: theme.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: theme.font.letterSpacing.wide,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${theme.spacing.xs} 0`,
  };

  const descriptionStyle: React.CSSProperties = {
    fontFamily: theme.font.body,
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
  };

  const kbdStyle: React.CSSProperties = {
    display: "inline-block",
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
    color: theme.color.text,
    background: theme.color.surfaceContainerHigh,
    border: `1px solid ${theme.color.borderSubtle}`,
    borderRadius: theme.radius.sm,
    padding: `2px 6px`,
    minWidth: 22,
    textAlign: "center",
  };

  const closeBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: theme.color.textMuted,
    cursor: "pointer",
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    padding: theme.spacing.xs,
  };

  const scopes = Array.from(grouped.entries());

  return (
    <div style={overlayStyle} onClick={() => setOpen(false)} data-testid="shortcut-help-overlay">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div style={titleStyle}>
          <span>Keyboard Shortcuts</span>
          <button style={closeBtnStyle} onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
        {scopes.map(([scope, entries]) => (
          <div key={scope}>
            <div style={scopeLabelStyle}>{scope}</div>
            {entries.map((entry) => (
              <div key={entry.keys} style={rowStyle}>
                <span style={descriptionStyle}>{entry.description}</span>
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {formatKeys(entry.keys).map((key, i, arr) => (
                    <span key={i}>
                      <span style={kbdStyle}>{key}</span>
                      {i < arr.length - 1 && entry.keys.includes(" ") ? (
                        <span style={{ color: theme.color.textFaint, fontSize: theme.font.size.xxs, margin: "0 2px" }}>
                          then
                        </span>
                      ) : null}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
