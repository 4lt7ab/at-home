import { useState } from "react";
import { TASK_STATUSES, AREAS } from "@domain/entities";
import type { HomeTaskSummary } from "@domain/entities";
import { useTasks } from "../hooks";
import type { ViewMode } from "../hooks";
import { createTasks } from "../api";
import { StatusDot } from "../components/StatusDot";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  } as React.CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 600,
  } as React.CSSProperties,

  addBtn: {
    fontSize: 13,
    padding: "6px 14px",
    border: "1px solid var(--color-accent)",
    borderRadius: 6,
    background: "var(--color-accent)",
    color: "var(--color-btn-text)",
    cursor: "pointer",
  } as React.CSSProperties,

  filterBar: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  select: {
    fontSize: 13,
    padding: "4px 8px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  card: {
    padding: "12px 14px",
    marginBottom: 8,
    borderRadius: 6,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border-light)",
    cursor: "pointer",
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: "var(--color-text)",
  } as React.CSSProperties,

  badge: (color: string, bg: string) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 6px",
    borderRadius: 4,
    color,
    background: bg,
    marginRight: 6,
  }),

  meta: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    marginTop: 4,
  } as React.CSSProperties,

  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "var(--color-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  } as React.CSSProperties,

  modal: {
    background: "var(--color-surface)",
    borderRadius: 8,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    boxShadow: "0 4px 24px var(--color-shadow)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    marginBottom: 12,
    fontFamily: "inherit",
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    marginBottom: 12,
    fontFamily: "inherit",
    resize: "vertical" as const,
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  formRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  } as React.CSSProperties,

  cancelBtn: {
    fontSize: 13,
    padding: "6px 14px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 6,
    background: "var(--color-surface)",
    color: "var(--color-text)",
    cursor: "pointer",
  } as React.CSSProperties,

  empty: {
    textAlign: "center" as const,
    padding: "32px 16px",
    color: "var(--color-text-faint)",
  } as React.CSSProperties,

  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  } as React.CSSProperties,

  viewToggle: {
    fontSize: 13,
    padding: "6px 10px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 6,
    background: "var(--color-surface)",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    marginRight: 8,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,

  descPreview: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    marginTop: 6,
    lineHeight: 1.4,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// CreateTaskOverlay
// ---------------------------------------------------------------------------

function CreateTaskOverlay({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    <div style={s.overlay} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>New Task</h3>
        <input
          style={s.input}
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={s.formRow}>
          <select style={{ ...s.select, flex: 1 }} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Area...</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select style={{ ...s.select, flex: 1 }} value={effort} onChange={(e) => setEffort(e.target.value)}>
            <option value="">Effort...</option>
            <option value="trivial">Trivial</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4, marginBottom: 4 }}>{error}</div>}
        <div style={s.formActions}>
          <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...s.addBtn, opacity: busy ? 0.5 : 1 }} disabled={busy}>
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

function TaskCard({ task, onClick, gallery }: { task: HomeTaskSummary; onClick: () => void; gallery?: boolean }) {
  return (
    <div style={gallery ? { ...s.card, marginBottom: 0 } : s.card} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}>
      <div style={s.cardTitle}>{task.title}</div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot status={task.status} />
        {task.area && (
          <span style={s.badge("var(--color-area)", "var(--color-area-bg)")}>{task.area.replace(/_/g, " ")}</span>
        )}
        {task.effort && (
          <span style={s.badge("var(--color-text-secondary)", "var(--color-muted-bg)")}>{task.effort}</span>
        )}
      </div>
      {gallery && task.has_description && (
        <div style={s.descPreview}>Has description</div>
      )}
    </div>
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
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const params: Record<string, string | number | undefined> = { limit: 100 };
  if (statusFilter) params.status = statusFilter;
  if (areaFilter) params.area = areaFilter;

  const { tasks, loading, error, refetch } = useTasks(params as never);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Tasks</h1>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            style={s.viewToggle}
            onClick={onToggleViewMode}
            title={`Toggle view (Shift+G) — ${viewMode === "list" ? "List" : "Gallery"}`}
          >
            <span>{viewMode === "list" ? "\u2630" : "\u2637"}</span>
            <span>{viewMode === "list" ? "List" : "Grid"}</span>
          </button>
          <button style={s.addBtn} onClick={() => setShowCreate(true)}>+ New Task</button>
        </div>
      </div>

      <div style={s.filterBar}>
        <select style={s.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <select style={s.select} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="">All areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {error && <div style={{ color: "var(--color-danger)", marginBottom: 12 }}>{error}</div>}

      {loading && tasks.length === 0 && (
        <div style={s.empty}>Loading tasks...</div>
      )}

      {!loading && tasks.length === 0 && (
        <div style={s.empty}>No tasks found. Create one to get started.</div>
      )}

      <div style={viewMode === "gallery" ? s.galleryGrid : undefined}>
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
    </div>
  );
}
