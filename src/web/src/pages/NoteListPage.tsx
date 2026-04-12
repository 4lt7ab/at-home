import { useState, useEffect } from "react";
import {
  semantic as t, Card, Badge, Button, Stack, Skeleton, EmptyState,
  Input, Select, Textarea, ModalShell,
} from "@4lt7ab/ui/ui";
import type { NoteSummary, HomeTaskSummary } from "@domain/entities";
import { useNotes } from "../hooks";
import { createNotes, fetchTasks } from "../api";

// ---------------------------------------------------------------------------
// CreateNoteOverlay
// ---------------------------------------------------------------------------

function CreateNoteOverlay({ tasks, onClose, onCreated }: {
  tasks: HomeTaskSummary[];
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>New Note</h3>
        <Stack gap="sm">
          <Input placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Textarea rows={4} placeholder="Content (optional)" value={content} onChange={(e) => setContent(e.target.value)} />
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Standalone (no task)</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </Select>
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
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, taskName }: { note: NoteSummary; taskName: string | null }): React.JSX.Element {
  return (
    <Card>
      <div style={{ fontSize: t.fontSizeMd, fontWeight: 500 }}>{note.title}</div>
      <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap" }}>
        {note.note_type === "completion" && <Badge variant="secondary">completion</Badge>}
        {taskName && <Badge variant="secondary">{taskName}</Badge>}
        {!taskName && <Badge variant="secondary">standalone</Badge>}
        {note.has_content && <Badge variant="secondary">has content</Badge>}
      </div>
      <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
        {new Date(note.created_at).toLocaleDateString()}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NoteListPage
// ---------------------------------------------------------------------------

type FilterMode = "all" | "manual" | "completion" | "linked" | "standalone";

export function NoteListPage(): React.JSX.Element {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [allTasks, setAllTasks] = useState<HomeTaskSummary[]>([]);

  useEffect(() => {
    fetchTasks({ limit: 200 }).then((r) => setAllTasks(r.data)).catch(() => {});
  }, []);

  const { notes, loading, error, refetch } = useNotes({ limit: 200 });

  const taskNameMap = new Map<string, string>();
  for (const task of allTasks) taskNameMap.set(task.id, task.title);

  const filtered = notes.filter((n) => {
    if (filter === "linked") return n.task_id !== null;
    if (filter === "standalone") return n.task_id === null;
    if (filter === "manual") return n.note_type === "manual";
    if (filter === "completion") return n.note_type === "completion";
    return true;
  });

  return (
    <PageShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: t.spaceLg }}>
        <h1 style={{ fontSize: t.fontSize2xl, fontWeight: 700, margin: 0 }}>Notes</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Note</Button>
      </div>

      <Stack direction="row" gap="xs" style={{ marginBottom: t.spaceLg }}>
        {(["all", "manual", "completion", "linked", "standalone"] as FilterMode[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </Stack>

      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{error}</div>}

      {loading && notes.length === 0 && (
        <Stack gap="sm">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState icon="search" message="No notes found">Create one to get started.</EmptyState>
      )}

      <Stack gap="sm">
        {filtered.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            taskName={note.task_id ? (taskNameMap.get(note.task_id) ?? null) : null}
          />
        ))}
      </Stack>

      {showCreate && (
        <CreateNoteOverlay
          tasks={allTasks}
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
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
