import { useState } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import {
  Card, Badge, Button, Stack, Skeleton, EmptyState,
  Input, Textarea, ModalShell,
} from "@4lt7ab/ui/ui";
import type { NoteSummary } from "@domain/entities";
import { useNotes } from "../hooks";
import { createNotes } from "../api";

// ---------------------------------------------------------------------------
// CreateNoteOverlay
// ---------------------------------------------------------------------------

function CreateNoteOverlay({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
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
        context: context.trim() || undefined,
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
          <Textarea rows={4} placeholder="Context (optional)" value={context} onChange={(e) => setContext(e.target.value)} />
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

function NoteCard({ note }: { note: NoteSummary }): React.JSX.Element {
  return (
    <Card>
      <div style={{ fontSize: t.fontSizeMd, fontWeight: 500 }}>{note.title}</div>
      <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap" }}>
        {note.has_context && <Badge variant="secondary">has context</Badge>}
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

export function NoteListPage(): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);

  const { notes, loading, error, refetch } = useNotes({ limit: 200 });

  return (
    <PageShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: t.spaceLg }}>
        <h1 style={{ fontSize: t.fontSize2xl, fontWeight: 700, margin: 0 }}>Notes</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Note</Button>
      </div>

      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{error}</div>}

      {loading && notes.length === 0 && (
        <Stack gap="sm">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      )}

      {!loading && notes.length === 0 && (
        <EmptyState icon="search" message="No notes found">Create one to get started.</EmptyState>
      )}

      <Stack gap="sm">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </Stack>

      {showCreate && (
        <CreateNoteOverlay
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
