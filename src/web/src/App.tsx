import { useMemo } from "react";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useHashRoute, useEventFanOut, EventSubscriptionContext, useViewMode, useHotkey } from "./hooks";
import { useThemeContext } from "./ThemeContext";
import type { ThemeMode } from "./hooks";
import { DailySummaryPage } from "./pages/DailySummaryPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { NoteListPage } from "./pages/NoteListPage";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { label: "Today", path: "/" },
  { label: "Tasks", path: "/tasks" },
  { label: "Notes", path: "/notes" },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Theme toggle helpers
// ---------------------------------------------------------------------------

const THEME_CYCLE: ThemeMode[] = ["auto", "light", "dark"];
const THEME_LABELS: Record<ThemeMode, string> = { auto: "Auto", light: "Light", dark: "Dark" };
const THEME_ICONS: Record<ThemeMode, string> = { auto: "\u25D0", light: "\u2600", dark: "\u263E" };

const styles = {
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    height: 48,
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,

  nav: {
    display: "flex",
    gap: 4,
  } as React.CSSProperties,

  navLink: (active: boolean) => ({
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--color-text)" : "var(--color-text-secondary)",
    padding: "6px 12px",
    borderRadius: 6,
    background: active ? "var(--color-nav-active-bg)" : "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
  }),

  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  themeToggle: {
    fontSize: 12,
    padding: "4px 8px",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    background: "var(--color-surface)",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    display: "flex",
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,

  connectionDot: (connected: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: connected ? "var(--color-success)" : "var(--color-danger-bright)",
    flexShrink: 0,
  }),

  main: {
    flex: 1,
    overflowY: "auto" as const,
    minHeight: 0,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const { path, navigate } = useHashRoute();
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);
  const { mode, setMode } = useThemeContext();
  const { viewMode, toggleViewMode } = useViewMode();

  useHotkey("g", { shift: true }, toggleViewMode);

  const taskDetailMatch = path.match(/^\/tasks\/([^/]+)$/);
  const taskId = taskDetailMatch?.[1] ?? null;

  const activePath = path.startsWith("/notes")
    ? "/notes"
    : path.startsWith("/tasks")
      ? "/tasks"
      : "/";

  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(mode);
    setMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }

  function renderView() {
    if (path.startsWith("/notes")) {
      return <NoteListPage viewMode={viewMode} onToggleViewMode={toggleViewMode} />;
    }
    if (taskId) {
      return <TaskDetailPage taskId={taskId} onBack={() => navigate("/tasks")} />;
    }
    if (path.startsWith("/tasks")) {
      return <TaskListPage onNavigate={navigate} viewMode={viewMode} onToggleViewMode={toggleViewMode} />;
    }
    return <DailySummaryPage />;
  }

  return (
    <EventSubscriptionContext.Provider value={eventCtx}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <header style={styles.topBar}>
          <nav style={styles.nav}>
            {navItems.map((item) => (
              <button
                key={item.path}
                style={styles.navLink(activePath === item.path)}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div style={styles.rightSection}>
            <button
              style={styles.themeToggle}
              onClick={cycleTheme}
              title={`Theme: ${THEME_LABELS[mode]}`}
            >
              <span>{THEME_ICONS[mode]}</span>
              <span>{THEME_LABELS[mode]}</span>
            </button>
            <div style={styles.connectionDot(connected)} title={connected ? "Connected" : "Disconnected"} />
          </div>
        </header>
        <main style={styles.main}>
          {renderView()}
        </main>
      </div>
    </EventSubscriptionContext.Provider>
  );
}
