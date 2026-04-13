import { useMemo, useState } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import { StatusDot, IconButton, ModalShell, ThemePicker } from "@4lt7ab/ui/ui";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useEventFanOut, useHashRoute, EventSubscriptionContext } from "./hooks";
import { NoteListPage } from "./pages/NoteListPage";
import { ReminderDashboardPage } from "./pages/ReminderDashboardPage";

// ---------------------------------------------------------------------------
// NavLink
// ---------------------------------------------------------------------------

function NavLink({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: t.fontSizeSm,
        fontWeight: active ? 600 : 400,
        color: active ? t.colorText : t.colorTextMuted,
        borderBottom: active ? `2px solid ${t.colorText}` : "2px solid transparent",
        padding: `0 ${t.spaceXs}`,
        lineHeight: "46px",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);
  const [showSettings, setShowSettings] = useState(false);
  const { path, navigate } = useHashRoute();

  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  const page = path.startsWith("/reminders") ? "reminders" : "notes";

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
          justifyContent: "space-between",
          height: 48,
          padding: `0 ${t.spaceLg}`,
          background: t.colorSurface,
          borderBottom: `1px solid ${t.colorBorder}`,
          flexShrink: 0,
        }}>
          <nav style={{ display: "flex", gap: t.spaceMd }}>
            <NavLink active={page === "notes"} onClick={() => navigate("/")}>Notes</NavLink>
            <NavLink active={page === "reminders"} onClick={() => navigate("/reminders")}>Reminders</NavLink>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm }}>
            <StatusDot
              status={connected ? "connected" : "disconnected"}
              color={connected ? "green" : "red"}
              size="sm"
            />
            <IconButton
              icon="settings"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
            />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {page === "reminders" ? <ReminderDashboardPage /> : <NoteListPage />}
        </main>

        {/* Settings modal */}
        {showSettings && (
          <ModalShell onClose={() => setShowSettings(false)}>
            <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>Settings</h3>
            <h4 style={{ fontSize: t.fontSizeSm, fontWeight: 500, color: t.colorTextSecondary, marginBottom: t.spaceMd }}>Theme</h4>
            <ThemePicker />
          </ModalShell>
        )}
      </div>
    </EventSubscriptionContext.Provider>
  );
}
