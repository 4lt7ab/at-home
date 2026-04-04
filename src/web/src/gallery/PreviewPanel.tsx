/**
 * PreviewPanel -- renders children in each available theme using isolated ThemeProviders.
 *
 * Each theme gets its own panel with the theme's surface background, creating
 * a side-by-side multi-theme preview.
 */
import { ThemeProvider, themes } from "../components/theme";
import { viewerTheme, viewerLabel } from "./viewerTheme";

interface PreviewPanelProps {
  children: (themeName: string) => React.ReactNode;
}

export function PreviewPanel({ children }: PreviewPanelProps) {
  const themeNames = Object.keys(themes);

  return (
    <div
      style={{
        display: "flex",
        gap: viewerTheme.spacing.lg,
        flexWrap: "wrap",
      }}
    >
      {themeNames.map((name) => {
        const t = themes[name];
        return (
          <div key={name} style={{ flex: "1 1 300px", minWidth: 280 }}>
            <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.sm }}>
              {name}
            </span>
            <ThemeProvider forcedTheme={name} isolated>
              <div
                style={{
                  padding: viewerTheme.spacing.lg,
                  background: t.color.surface,
                  borderRadius: viewerTheme.radius,
                  border: `1px solid ${viewerTheme.border}`,
                  minHeight: 60,
                }}
              >
                {children(name)}
              </div>
            </ThemeProvider>
          </div>
        );
      })}
    </div>
  );
}
