import { useMemo } from "react";
import { semantic as t, StatusDot } from "@4lt7ab/ui/ui";
import { useTheme } from "@4lt7ab/ui/core";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useHashRoute, useEventFanOut, EventSubscriptionContext } from "./hooks";
import { DailySummaryPage } from "./pages/DailySummaryPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { NoteListPage } from "./pages/NoteListPage";

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: "Today", path: "/" },
  { label: "Tasks", path: "/tasks" },
  { label: "Notes", path: "/notes" },
] as const;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const { path, navigate } = useHashRoute();
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);

  const { theme, setTheme, themes } = useTheme();
  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  const activePath = path.startsWith("/notes")
    ? "/notes"
    : path.startsWith("/tasks")
      ? "/tasks"
      : "/";

  const taskDetailMatch = path.match(/^\/tasks\/([^/]+)$/);
  const taskId = taskDetailMatch?.[1] ?? null;

  function renderPage(): React.JSX.Element {
    if (path.startsWith("/notes")) return <NoteListPage />;
    if (taskId) return <TaskDetailPage taskId={taskId} onBack={() => navigate("/tasks")} />;
    if (path.startsWith("/tasks")) return <TaskListPage onNavigate={navigate} />;
    return <DailySummaryPage onNavigate={navigate} />;
  }

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
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: `${t.spaceXs} ${t.spaceSm}`,
                  borderRadius: t.radiusMd,
                  fontSize: t.fontSizeSm,
                  fontFamily: t.fontSans,
                  fontWeight: activePath === item.path ? 600 : 400,
                  color: activePath === item.path ? t.colorActionPrimary : t.colorTextSecondary,
                  transition: "color 150ms",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
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
          {renderPage()}
        </main>
      </div>
    </EventSubscriptionContext.Provider>
  );
}
