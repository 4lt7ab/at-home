import { useState, useEffect } from "react";
import type { NoteSummary, HomeTaskSummary } from "@domain/entities";
import { useNotes } from "../hooks";
import type { ViewMode } from "../hooks";
import { createNotes, fetchTasks } from "../api";

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

  filterBtn: (active: boolean) => ({
    fontSize: 13,
    padding: "4px 12px",
    border: "1px solid " + (active ? "var(--color-accent)" : "var(--color-input-border)"),
    borderRadius: 4,
    background: active ? "var(--color-accent-bg)" : "var(--color-surface)",
    color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
    cursor: "pointer",
  }),

  card: {
    padding: "12px 14px",
    marginBottom: 8,
    borderRadius: 6,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border-light)",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: "var(--color-text)",
  } as React.CSSProperties,

  meta: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    marginTop: 4,
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

  select: {
    width: "100%",
    fontSize: 13,
    padding: "4px 8px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    background: "var(--color-surface)",
    color: "var(--color-text)",
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
};

// ---------------------------------------------------------------------------
// CreateNoteOverlay
// ---------------------------------------------------------------------------

function CreateNoteOverlay({ tasks, onClose, onCreated }: {
  tasks: HomeTaskSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [taskId, setTaskId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createNotes([{
        title: title.trim(),
        content: content.trim() || undefined,
        task_id: taskId || undefined,
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
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>New Note</h3>
        <input
          style={s.input}
          placeholder="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          style={s.textarea}
          rows={4}
          placeholder="Content (optional)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <select style={s.select} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">Standalone (no task)</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
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
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, taskName, gallery }: { note: NoteSummary; taskName: string | null; gallery?: boolean }) {
  return (
    <div style={gallery ? { ...s.card, marginBottom: 0 } : s.card}>
      <div style={s.cardTitle}>{note.title}</div>
      <div style={{ marginTop: 4 }}>
        {taskName ? (
          <span style={s.badge("var(--color-area)", "var(--color-area-bg)")}>{taskName}</span>
        ) : (
          <span style={s.badge("var(--color-text-muted)", "var(--color-muted-bg)")}>standalone</span>
        )}
        {note.has_content && (
          <span style={s.badge("var(--color-success)", "var(--color-success-bg)")}>has content</span>
        )}
      </div>
      <div style={s.meta}>
        Created: {new Date(note.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteListPage
// ---------------------------------------------------------------------------

type FilterMode = "all" | "linked" | "standalone";

export function NoteListPage({ viewMode, onToggleViewMode }: {
  viewMode: ViewMode;
  onToggleViewMode: () => void;
}) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [allTasks, setAllTasks] = useState<HomeTaskSummary[]>([]);

  // Load all tasks for the task name lookup and creation dropdown (paginate if >200)
  useEffect(() => {
    fetchTasks({ limit: 200 }).then(async (r) => {
      let allData = [...r.data];
      let offset = 200;
      while (offset < r.total) {
        const page = await fetchTasks({ limit: 200, offset });
        allData = allData.concat(page.data);
        offset += 200;
      }
      setAllTasks(allData);
    }).catch(() => {});
  }, []);

  const { notes, loading, error, refetch } = useNotes({ limit: 200 });

  // Build task name map
  const taskNameMap = new Map<string, string>();
  for (const t of allTasks) {
    taskNameMap.set(t.id, t.title);
  }

  // Filter notes
  const filtered = notes.filter((n) => {
    if (filter === "linked") return n.task_id !== null;
    if (filter === "standalone") return n.task_id === null;
    return true;
  });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Notes</h1>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            style={s.viewToggle}
            onClick={onToggleViewMode}
            title={`Toggle view (Shift+G) — ${viewMode === "list" ? "List" : "Gallery"}`}
          >
            <span>{viewMode === "list" ? "\u2630" : "\u2637"}</span>
            <span>{viewMode === "list" ? "List" : "Grid"}</span>
          </button>
          <button style={s.addBtn} onClick={() => setShowCreate(true)}>+ New Note</button>
        </div>
      </div>

      <div style={s.filterBar}>
        {(["all", "linked", "standalone"] as FilterMode[]).map((f) => (
          <button
            key={f}
            style={s.filterBtn(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: "var(--color-danger)", marginBottom: 12 }}>{error}</div>}

      {loading && notes.length === 0 && (
        <div style={s.empty}>Loading notes...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={s.empty}>No notes found.</div>
      )}

      <div style={viewMode === "gallery" ? s.galleryGrid : undefined}>
        {filtered.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            taskName={note.task_id ? (taskNameMap.get(note.task_id) ?? null) : null}
            gallery={viewMode === "gallery"}
          />
        ))}
      </div>

      {showCreate && (
        <CreateNoteOverlay
          tasks={allTasks}
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
