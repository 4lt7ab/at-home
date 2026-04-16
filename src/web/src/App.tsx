import { useMemo, useCallback } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import { StatusDot, Surface, TabStrip, ThemePicker } from "@4lt7ab/ui/ui";
import { ThemeBackground } from "@4lt7ab/ui/animations";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useEventFanOut, useHashRoute, EventSubscriptionContext } from "./hooks";
import { NoteListPage } from "./pages/NoteListPage";
import { ReminderDashboardPage } from "./pages/ReminderDashboardPage";

const NAV_TABS = [
  { key: "notes", label: "Notes" },
  { key: "reminders", label: "Reminders" },
] as const;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);
  const { path, navigate } = useHashRoute();

  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  const page = path.startsWith("/reminders") ? "reminders" : "notes";

  const handleTabChange = useCallback((key: string | null) => {
    if (key === "reminders") navigate("/reminders");
    else navigate("/");
  }, [navigate]);

  return (
    <EventSubscriptionContext.Provider value={eventCtx}>
      <ThemeBackground />
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        color: t.colorText,
        fontFamily: t.fontSans,
      }}>
        {/* Top bar */}
        <Surface
          level="panel"
          radius="none"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 48,
            padding: `0 ${t.spaceLg}`,
            borderBottom: `1px solid ${t.colorBorder}`,
            flexShrink: 0,
          }}
        >
          <TabStrip
            tabs={NAV_TABS as unknown as { key: string; label: string }[]}
            activeKey={page}
            onChange={handleTabChange}
            size="sm"
          />
          <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm }}>
            <StatusDot
              status={connected ? "connected" : "disconnected"}
              color={connected ? "green" : "red"}
              size="sm"
            />
            <ThemePicker variant="compact" />
          </div>
        </Surface>

        {/* Page content — Surface provides the page background */}
        <main style={{ flex: 1, overflowY: "auto", minHeight: 0, background: t.colorSurfacePage }}>
          {page === "reminders" ? <ReminderDashboardPage /> : <NoteListPage />}
        </main>
      </div>
    </EventSubscriptionContext.Provider>
  );
}
