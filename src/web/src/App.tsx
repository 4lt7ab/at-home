import { useMemo } from "react";
import { semantic as t, StatusDot } from "@4lt7ab/ui/ui";
import { useTheme } from "@4lt7ab/ui/core";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useEventFanOut, EventSubscriptionContext } from "./hooks";
import { NoteListPage } from "./pages/NoteListPage";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);

  const { theme, setTheme, themes } = useTheme();
  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  return (
    <EventSubscriptionContext.Provider value={eventCtx}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: t.colorSurfacePage,
        color: t.colorText,
        fontFamily: t.fontSans,
      }}>
        {/* Top bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          height: 48,
          padding: `0 ${t.spaceLg}`,
          background: t.colorSurface,
          borderBottom: `1px solid ${t.colorBorder}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm }}>
            <StatusDot
              status={connected ? "connected" : "disconnected"}
              color={connected ? "green" : "red"}
              size="sm"
            />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              style={{
                background: t.colorSurfaceInput,
                color: t.colorText,
                border: `1px solid ${t.colorBorder}`,
                borderRadius: t.radiusMd,
                padding: `${t.spaceXs} ${t.spaceSm}`,
                fontSize: t.fontSizeXs,
                fontFamily: t.fontSans,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {Array.from(themes.keys()).map((name) => (
                <option key={name} value={name}>
                  {themes.get(name)?.label ?? name}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <NoteListPage />
        </main>
      </div>
    </EventSubscriptionContext.Provider>
  );
}
