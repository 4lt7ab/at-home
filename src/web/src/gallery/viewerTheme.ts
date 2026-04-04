/**
 * Viewer theme -- neutral dark palette for gallery chrome.
 *
 * This theme is used for the gallery UI itself (sidebar, controls, labels)
 * so that component previews have clear visual boundaries against a
 * neutral backdrop that does not match any app theme.
 */
// ---------------------------------------------------------------------------
// Viewer tokens
// ---------------------------------------------------------------------------

export const viewerTheme = {
  bg: "#1a1a2e",
  bgSurface: "#16162a",
  bgPanel: "#222240",
  text: "#d0d0e0",
  textMuted: "#8888aa",
  textFaint: "#666688",
  border: "#2a2a4e",
  borderSubtle: "#22223c",
  accent: "#7c7cf0",
  accentMuted: "#5858b0",
  radius: 8,
  font: "'Inter', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  fontSize: {
    xs: "0.7rem",
    sm: "0.8rem",
    md: "0.9rem",
    lg: "1.1rem",
    xl: "1.4rem",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
  },
} as const;

// ---------------------------------------------------------------------------
// Viewer style helpers
// ---------------------------------------------------------------------------

export function viewerPanel(): React.CSSProperties {
  return {
    background: viewerTheme.bgPanel,
    border: `1px solid ${viewerTheme.border}`,
    borderRadius: viewerTheme.radius,
    padding: viewerTheme.spacing.lg,
  };
}

export function viewerLabel(): React.CSSProperties {
  return {
    fontSize: viewerTheme.fontSize.xs,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: viewerTheme.textMuted,
    fontFamily: viewerTheme.font,
  };
}

export function viewerHeading(): React.CSSProperties {
  return {
    fontSize: viewerTheme.fontSize.xl,
    fontWeight: 700,
    color: viewerTheme.text,
    fontFamily: viewerTheme.font,
    margin: 0,
  };
}

export function viewerSubheading(): React.CSSProperties {
  return {
    fontSize: viewerTheme.fontSize.lg,
    fontWeight: 600,
    color: viewerTheme.text,
    fontFamily: viewerTheme.font,
    margin: 0,
  };
}
