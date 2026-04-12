import { useState } from "react";
import {
  semantic as t, Card, Badge, Button, Stack, Skeleton, EmptyState,
  Input, Select, Textarea, ModalShell, StatusDot,
} from "@4lt7ab/ui/ui";
import { TASK_STATUSES, AREAS } from "@domain/entities";
import type { HomeTaskSummary } from "@domain/entities";
import { useTasks } from "../hooks";
import { createTasks } from "../api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onNavigate: (path: string) => void;
}

// ---------------------------------------------------------------------------
// CreateTaskOverlay
// ---------------------------------------------------------------------------

function CreateTaskOverlay({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [effort, setEffort] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>New Task</h3>
        <Stack gap="sm">
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Textarea rows={3} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Stack gap="sm" direction="row">
            <Select style={{ flex: 1 }} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Area...</option>
              {AREAS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
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
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <Stack direction="row" gap="sm" style={{ marginTop: t.spaceLg, justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating..." : "Create"}</Button>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

function TaskCard({ task, onClick }: { task: HomeTaskSummary; onClick: () => void }): React.JSX.Element {
  return (
    <Card onClick={onClick} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: t.fontSizeMd, fontWeight: 500 }}>{task.title}</div>
          <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap" }}>
            <StatusDot status={task.status} color={statusColor(task.status)} size="sm" />
            <Badge variant="secondary">{task.status}</Badge>
            {task.area && <Badge variant="secondary">{task.area.replace(/_/g, " ")}</Badge>}
            {task.effort && <Badge variant="secondary">{task.effort}</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "active": return "green";
    case "paused": return "yellow";
    case "done": return "blue";
    case "archived": return "gray";
    default: return "gray";
  }
}

// ---------------------------------------------------------------------------
// TaskListPage
// ---------------------------------------------------------------------------

export function TaskListPage({ onNavigate }: Props): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, string | number | undefined> = { limit: 100 };
  if (statusFilter) params.status = statusFilter;
  if (areaFilter) params.area = areaFilter;

  const { tasks, loading, error, refetch } = useTasks(params as never);

  return (
    <PageShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: t.spaceLg }}>
        <h1 style={{ fontSize: t.fontSize2xl, fontWeight: 700, margin: 0 }}>Tasks</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Task</Button>
      </div>

      <Stack direction="row" gap="sm" style={{ marginBottom: t.spaceLg }}>
        <Select style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select style={{ width: "auto" }} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="">All areas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </Select>
      </Stack>

      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{error}</div>}

      {loading && tasks.length === 0 && (
        <Stack gap="sm">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      )}

      {!loading && tasks.length === 0 && (
        <EmptyState icon="search" message="No tasks found">Create one to get started.</EmptyState>
      )}

      <Stack gap="sm">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={() => onNavigate(`/tasks/${task.id}`)} />
        ))}
      </Stack>

      {showCreate && <CreateTaskOverlay onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// PageShell
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{
      maxWidth: 800,
      margin: "0 auto",
      padding: `${t.spaceXl} ${t.spaceLg}`,
    }}>
      {children}
    </div>
  );
}
