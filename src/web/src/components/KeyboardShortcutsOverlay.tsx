import { ModalShell, Stack } from "@4lt7ab/ui/ui";
import { semantic as t } from "@4lt7ab/ui/core";
import { useRegisteredShortcuts } from "../hooks";

// ---------------------------------------------------------------------------
// KeyboardShortcutsOverlay
//
// Reads every shortcut currently registered through useShortcut() and renders
// them grouped by scope. Lightweight composition over ModalShell — the list
// is read on open so a shortcut registered after the overlay opens won't
// appear until reopen, which matches the user's mental model (they pressed
// `?` to see the current state).
// ---------------------------------------------------------------------------

// Use pretty symbols where possible; fall back to the literal key name.
function renderKey(keys: string): React.JSX.Element {
  const parts = keys.split(/\s+/);
  return (
    <span style={{ display: "inline-flex", gap: "2px", alignItems: "center" }}>
      {parts.map((part, i) => (
        <kbd
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: `0 ${t.spaceXs}`,
            minWidth: "1.5em",
            height: "1.5em",
            background: t.colorSurfaceRaised,
            color: t.colorTextMuted,
            border: `${t.borderWidthDefault} solid ${t.colorBorder}`,
            borderRadius: t.radiusSm,
            fontSize: t.fontSizeXs,
            fontFamily: t.fontMono,
            lineHeight: 1,
          }}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

export function KeyboardShortcutsOverlay({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  const grouped = useRegisteredShortcuts();

  return (
    <ModalShell onClose={onClose} width="lg">
      <h3
        style={{
          fontSize: t.fontSizeLg,
          fontWeight: t.fontWeightSemibold,
          marginBottom: t.spaceLg,
        }}
      >
        Keyboard shortcuts
      </h3>
      <Stack gap="lg">
        {Array.from(grouped.entries()).map(([scope, entries]) => (
          <div key={scope}>
            <div
              style={{
                fontSize: t.fontSizeXs,
                fontWeight: t.fontWeightSemibold,
                color: t.colorTextMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: t.spaceSm,
              }}
            >
              {scope}
            </div>
            <Stack gap="xs">
              {entries.map((entry) => (
                <div
                  key={`${entry.scope}-${entry.keys}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: t.fontSizeSm,
                  }}
                >
                  <span>{entry.description}</span>
                  {renderKey(entry.keys)}
                </div>
              ))}
            </Stack>
          </div>
        ))}
        {grouped.size === 0 && (
          <div style={{ color: t.colorTextMuted, fontSize: t.fontSizeSm }}>
            No shortcuts registered.
          </div>
        )}
      </Stack>
    </ModalShell>
  );
}
