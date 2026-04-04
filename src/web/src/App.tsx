import { useMemo } from "react";
import { useRealtimeEvents } from "./useRealtimeEvents";
import { useHashRoute, useEventFanOut, EventSubscriptionContext, useViewMode, useShortcut } from "./hooks";
import { useTheme } from "./components/theme";
import { AnimationStyles, StatusDot } from "./components/atoms";
import { ThemeSwitcher } from "./components/molecules";
import { TopBar } from "./components/organisms/TopBar";
import { ErrorBoundary } from "./components/organisms/ErrorBoundary";
import { ShortcutHelpOverlay } from "./components/organisms";
import { DailySummaryPage } from "./pages/DailySummaryPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { NoteListPage } from "./pages/NoteListPage";
import { GalleryPage } from "./gallery";

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
// App
// ---------------------------------------------------------------------------

export function App() {
  const { path, navigate } = useHashRoute();
  const { onEvent, subscribeEvents } = useEventFanOut();
  const { connected } = useRealtimeEvents(onEvent);
  const { theme } = useTheme();
  const { viewMode, toggleViewMode } = useViewMode();

  useShortcut("shift+g", "Toggle view mode", toggleViewMode, "Navigation");
  useShortcut("ctrl+shift+g", "Open component gallery", () => navigate("/gallery"), "Navigation");

  const taskDetailMatch = path.match(/^\/tasks\/([^/]+)$/);
  const taskId = taskDetailMatch?.[1] ?? null;

  const activePath = path.startsWith("/notes")
    ? "/notes"
    : path.startsWith("/tasks")
      ? "/tasks"
      : "/";

  const eventCtx = useMemo(() => ({ subscribeEvents, connected }), [subscribeEvents, connected]);

  function renderView() {
    if (path === "/gallery") {
      return <GalleryPage />;
    }
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

  const trailing = (
    <>
      <ThemeSwitcher />
      <StatusDot
        status={connected ? "Connected" : "Disconnected"}
        color={connected ? theme.color.success : theme.color.danger}
      />
    </>
  );

  return (
    <EventSubscriptionContext.Provider value={eventCtx}>
      <AnimationStyles />
      <ShortcutHelpOverlay />
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopBar
          navItems={navItems}
          activePath={activePath}
          onNavigate={navigate}
          trailing={trailing}
        />
        <main style={{ flex: 1, overflowY: "auto" as const, minHeight: 0 }}>
          <ErrorBoundary>
            {renderView()}
          </ErrorBoundary>
        </main>
      </div>
    </EventSubscriptionContext.Provider>
  );
}
