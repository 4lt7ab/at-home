import { useState, useEffect } from "react";
import type { NoteSummary, HomeTaskSummary } from "@domain/entities";
import { useNotes } from "../hooks";
import type { ViewMode } from "../hooks";
import { createNotes, fetchTasks } from "../api";
import { useTheme } from "../components/theme";
import { Button, Input, Textarea, Select, Badge } from "../components/atoms";
import { Stack, EmptyState } from "../components/molecules";
import { ModalShell } from "../components/organisms";
import { ListPageLayout } from "../components/templates";
import { ContentCard } from "../components/ContentCard";

// ---------------------------------------------------------------------------
// CreateNoteOverlay
// ---------------------------------------------------------------------------

function CreateNoteOverlay({ tasks, onClose, onCreated }: {
  tasks: HomeTaskSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { theme } = useTheme();
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
    <ModalShell onClose={onClose} maxWidth={400}>
      <form onSubmit={handleSubmit}>
        <h3 style={{
          fontSize: theme.font.size.md,
          fontWeight: 600,
          marginBottom: theme.spacing.lg,
          color: theme.color.text,
          fontFamily: theme.font.body,
        }}>New Note</h3>
        <Stack direction="column" gap="md">
          <Input
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            rows={4}
            placeholder="Content (optional)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Standalone (no task)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </Select>
          {error && (
            <div style={{
              color: theme.color.danger,
              fontSize: theme.font.size.xs,
            }}>{error}</div>
          )}
          <Stack direction="row" gap="sm" justify="flex-end" style={{ marginTop: theme.spacing.xs }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={busy} disabled={busy}>
              {busy ? "Creating..." : "Create"}
            </Button>
          </Stack>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, taskName, gallery }: { note: NoteSummary; taskName: string | null; gallery?: boolean }) {
  const { theme } = useTheme();

  return (
    <ContentCard
      variant={note.note_type === "completion" ? "completion-note" : "note"}
      compact={gallery}
    >
      <div style={{
        fontSize: theme.font.size.sm,
        fontWeight: 500,
        color: theme.color.text,
        fontFamily: theme.font.body,
      }}>{note.title}</div>
      <div style={{ marginTop: theme.spacing.xs }}>
        {note.note_type === "completion" && (
          <Badge variant="completion">completion</Badge>
        )}
        {taskName ? (
          <Badge variant="area">{taskName}</Badge>
        ) : (
          <Badge variant="standalone">standalone</Badge>
        )}
        {note.has_content && (
          <Badge variant="content">has content</Badge>
        )}
      </div>
      <div style={{
        fontSize: theme.font.size.xs,
        color: theme.color.textMuted,
        marginTop: theme.spacing.xs,
        fontFamily: theme.font.body,
      }}>
        Created: {new Date(note.created_at).toLocaleDateString()}
      </div>
    </ContentCard>
  );
}

// ---------------------------------------------------------------------------
// NoteListPage
// ---------------------------------------------------------------------------

type FilterMode = "all" | "linked" | "standalone" | "manual" | "completion";

export function NoteListPage({ viewMode, onToggleViewMode }: {
  viewMode: ViewMode;
  onToggleViewMode: () => void;
}) {
  const { theme } = useTheme();
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
    if (filter === "manual") return n.note_type === "manual";
    if (filter === "completion") return n.note_type === "completion";
    return true;
  });

  return (
    <ListPageLayout>
      <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: theme.spacing.lg }}>
        <h1 style={{
          fontSize: theme.font.size.lg,
          fontWeight: 600,
          color: theme.color.text,
          fontFamily: theme.font.headline,
        }}>Notes</h1>
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
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Note</Button>
        </Stack>
      </Stack>

      <Stack direction="row" gap="sm" wrap style={{ marginBottom: theme.spacing.lg }}>
        {(["all", "manual", "completion", "linked", "standalone"] as FilterMode[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </Stack>

      {error && (
        <div style={{
          color: theme.color.danger,
          marginBottom: theme.spacing.md,
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.body,
        }}>{error}</div>
      )}

      {loading && notes.length === 0 && (
        <EmptyState icon="hourglass_empty" message="Loading notes..." />
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState icon="note" message="No notes found." />
      )}

      <div style={viewMode === "gallery" ? {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: theme.spacing.md,
      } : undefined}>
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
    </ListPageLayout>
  );
}
