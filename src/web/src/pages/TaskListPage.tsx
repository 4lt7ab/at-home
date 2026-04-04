import { useState } from "react";
import { TASK_STATUSES, AREAS } from "@domain/entities";
import type { HomeTaskSummary } from "@domain/entities";
import { useTasks } from "../hooks";
import type { ViewMode } from "../hooks";
import { createTasks } from "../api";
import { useTheme } from "../components/theme";
import { Button, Input, Select, Textarea, StatusDot, Badge, Skeleton } from "../components/atoms";
import { Card, Stack, EmptyState } from "../components/molecules";
import { ModalShell } from "../components/organisms";
import { ListPageLayout } from "../components/templates";

// ---------------------------------------------------------------------------
// CreateTaskOverlay
// ---------------------------------------------------------------------------

function CreateTaskOverlay({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState<string>("");
  const [effort, setEffort] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createTasks([{
        title: title.trim(),
        description: description.trim() || undefined,
        area: area || undefined,
        effort: effort || undefined,
      }]);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth={400}>
      <form onSubmit={handleSubmit}>
        <h3
          style={{
            fontSize: theme.font.size.md,
            fontWeight: 600,
            marginBottom: theme.spacing.lg,
            fontFamily: theme.font.headline,
            color: theme.color.text,
          }}
        >
          New Task
        </h3>
        <Stack direction="column" gap="sm">
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            rows={3}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Stack direction="row" gap="sm">
            <Select style={{ flex: 1 }} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Area...</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </Select>
            <Select style={{ flex: 1 }} value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="">Effort...</option>
              <option value="trivial">Trivial</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Stack>
        </Stack>
        {error && (
          <div
            style={{
              color: theme.color.danger,
              fontSize: theme.font.size.xs,
              marginTop: theme.spacing.xs,
              marginBottom: theme.spacing.xs,
            }}
          >
            {error}
          </div>
        )}
        <Stack direction="row" gap="sm" justify="flex-end" style={{ marginTop: theme.spacing.md }}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={busy}>
            {busy ? "Creating..." : "Create"}
          </Button>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

function TaskCard({ task, onClick, gallery }: { task: HomeTaskSummary; onClick: () => void; gallery?: boolean }) {
  const { theme } = useTheme();

  return (
    <Card
      hover
      onClick={onClick}
      style={gallery ? undefined : { marginBottom: theme.spacing.sm }}
    >
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        style={{ outline: "none" }}
      >
        <div
          style={{
            fontSize: theme.font.size.sm,
            fontWeight: 500,
            color: theme.color.text,
            fontFamily: theme.font.body,
          }}
        >
          {task.title}
        </div>
        <Stack direction="row" gap="xs" align="center" style={{ marginTop: theme.spacing.xs }}>
          <StatusDot status={task.status} />
          {task.area && (
            <Badge variant="area">{task.area.replace(/_/g, " ")}</Badge>
          )}
          {task.effort && (
            <Badge variant="effort">{task.effort}</Badge>
          )}
        </Stack>
        {gallery && task.has_description && (
          <div
            style={{
              fontSize: theme.font.size.xs,
              color: theme.color.textMuted,
              marginTop: theme.spacing.sm,
              lineHeight: theme.font.lineHeight.tight,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            Has description
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TaskListPage
// ---------------------------------------------------------------------------

export function TaskListPage({ onNavigate, viewMode, onToggleViewMode }: {
  onNavigate: (to: string) => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
}) {
  const { theme } = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, string | number | undefined> = { limit: 100 };
  if (statusFilter) params.status = statusFilter;
  if (areaFilter) params.area = areaFilter;

  const { tasks, loading, error, refetch } = useTasks(params as never);

  return (
    <ListPageLayout>
      <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: theme.spacing.lg }}>
        <h1
          style={{
            fontSize: theme.font.size.lg,
            fontWeight: 600,
            fontFamily: theme.font.headline,
            color: theme.color.text,
          }}
        >
          Tasks
        </h1>
        <Stack direction="row" align="center" gap="sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleViewMode}
            title={`Toggle view (Shift+G) — ${viewMode === "list" ? "List" : "Gallery"}`}
          >
            <span>{viewMode === "list" ? "\u2630" : "\u2637"}</span>
            <span>{viewMode === "list" ? "List" : "Grid"}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Task</Button>
        </Stack>
      </Stack>

      <Stack direction="row" gap="sm" wrap style={{ marginBottom: theme.spacing.lg }}>
        <Select
          style={{ width: "auto" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </Select>
        <Select
          style={{ width: "auto" }}
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="">All areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Stack>

      {error && (
        <div
          style={{
            color: theme.color.danger,
            marginBottom: theme.spacing.md,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.body,
          }}
        >
          {error}
        </div>
      )}

      {loading && tasks.length === 0 && (
        <Stack direction="column" gap="sm">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      )}

      {!loading && tasks.length === 0 && (
        <EmptyState
          icon="task_alt"
          message="No tasks found. Create one to get started."
        />
      )}

      <div
        style={
          viewMode === "gallery"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: theme.spacing.md,
              }
            : undefined
        }
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onNavigate(`/tasks/${task.id}`)}
            gallery={viewMode === "gallery"}
          />
        ))}
      </div>

      {showCreate && (
        <CreateTaskOverlay
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
    </ListPageLayout>
  );
}
