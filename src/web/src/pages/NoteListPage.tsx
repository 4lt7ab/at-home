import { useState, useEffect, useCallback } from "react";
import { semantic as t, staggerStyle } from "@4lt7ab/ui/core";
import {
  Button, IconButton, Card, Stack, Skeleton, EmptyState,
  Input, Textarea, ModalShell, ConfirmDialog, Field,
  SearchInput, Surface,
} from "@4lt7ab/ui/ui";
import { Markdown } from "@4lt7ab/ui/content";
import type { Note, NoteSummary } from "@domain/entities";
import { useNotes, useWindowWidth, SMALL_BREAKPOINT, useShortcut } from "../hooks";
import { fetchNote, createNotes, updateNotes, deleteNotes } from "../api";
import { formatRelativeTime } from "../utils";

// ---------------------------------------------------------------------------
// NoteListItem
// ---------------------------------------------------------------------------

function NoteListItem({ note, selected, onClick, index }: {
  note: NoteSummary;
  selected: boolean;
  onClick: () => void;
  index: number;
}): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      style={{
        ...staggerStyle(index),
        cursor: "pointer",
        borderRadius: t.radiusMd,
        padding: `${t.spaceSm} ${t.spaceMd}`,
        background: selected ? t.colorSurfaceRaised : "transparent",
        borderLeft: selected ? `${t.borderWidthAccent} solid ${t.colorActionPrimary}` : `${t.borderWidthAccent} solid transparent`,
        transition: `background ${t.transitionBase}, border-color ${t.transitionBase}`,
      }}
    >
      <div style={{
        fontSize: t.fontSizeSm,
        fontWeight: selected ? t.fontWeightSemibold : t.fontWeightMedium,
        color: t.colorText,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {note.title}
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: t.spaceXs,
        marginTop: "2px",
      }}>
        <span style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
          {formatRelativeTime(note.updated_at)}
        </span>
        {note.has_context && (
          <span style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: t.radiusFull,
            background: t.colorActionPrimary,
            flexShrink: 0,
          }} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteDetailPanel
// ---------------------------------------------------------------------------

function NoteDetailPanel({ note, onEdit, onDelete }: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div style={{ padding: `${t.spaceXl} ${t.spaceLg}`, maxWidth: 720 }}>
      <div style={staggerStyle(0, { duration: 0.25 })}>
      <Surface level="solid" padding="lg" border radius="lg">
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: t.spaceLg,
          gap: t.spaceMd,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: t.fontSize2xl,
              fontWeight: t.fontWeightBold,
              fontFamily: t.fontSerif,
              color: t.colorText,
              margin: 0,
              lineHeight: t.lineHeightTight,
            }}>
              {note.title}
            </h1>
            <div style={{
              fontSize: t.fontSizeXs,
              color: t.colorTextMuted,
              marginTop: t.spaceXs,
            }}>
              {new Date(note.created_at).toLocaleDateString(undefined, {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
              {note.updated_at !== note.created_at && (
                <> · edited {formatRelativeTime(note.updated_at)}</>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: t.spaceXs, flexShrink: 0 }}>
            <IconButton icon="edit" size="md" aria-label="Edit note" onClick={onEdit} />
            <IconButton icon="trash" size="md" aria-label="Delete note" onClick={onDelete} />
          </div>
        </div>

        {/* Body */}
        {note.context ? (
          <Markdown>{note.context}</Markdown>
        ) : (
          <p style={{
            color: t.colorTextMuted,
            fontStyle: "italic",
            fontSize: t.fontSizeSm,
            margin: 0,
          }}>
            This note has no content yet. Click edit to add some.
          </p>
        )}
      </Surface>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateNoteOverlay
// ---------------------------------------------------------------------------

function CreateNoteOverlay({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
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
      const notes = await createNotes([{
        title: title.trim(),
        context: context.trim() || undefined,
      }]);
      onCreated(notes[0].id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} width="lg">
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>New Note</h3>
        <Stack gap="sm">
          <Field label="Title" htmlFor="note-title" required>
            <Input id="note-title" placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Content" htmlFor="note-context" help="Markdown supported">
            <Textarea id="note-context" rows={8} placeholder="Write something..." value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <div style={{ marginTop: t.spaceLg }}>
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating..." : "Create"}</Button>
          </Stack>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// EditNoteOverlay
// ---------------------------------------------------------------------------

function EditNoteOverlay({ note, onClose, onSaved }: {
  note: Note;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(note.title);
  const [context, setContext] = useState(note.context ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await updateNotes([{
        id: note.id,
        title: title.trim(),
        context: context.trim() || null,
      }]);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} width="lg">
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>Edit Note</h3>
        <Stack gap="sm">
          <Field label="Title" htmlFor="edit-title" required>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Content" htmlFor="edit-context" help="Markdown supported">
            <Textarea id="edit-context" rows={12} value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <div style={{ marginTop: t.spaceLg }}>
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          </Stack>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// NoteListPage
// ---------------------------------------------------------------------------

export function NoteListPage(): React.JSX.Element {
  const width = useWindowWidth();
  const isDesktop = width >= SMALL_BREAKPOINT;

  // -- State ---------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { notes, total, loading, error, refetch } = useNotes({
    title: search || undefined,
    limit: 200,
  });

  // -- Load selected note detail -------------------------------------------
  const loadNote = useCallback((id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    fetchNote(id)
      .then((note) => {
        setSelectedNote(note);
        setLoadingDetail(false);
      })
      .catch(() => {
        setSelectedNote(null);
        setLoadingDetail(false);
      });
  }, []);

  // Auto-select first note when list loads and nothing is selected (desktop only)
  useEffect(() => {
    if (isDesktop && !selectedId && notes.length > 0) {
      loadNote(notes[0].id);
    }
  }, [notes, selectedId, loadNote, isDesktop]);

  // If selected note was deleted, clear selection
  useEffect(() => {
    if (selectedId && notes.length > 0 && !notes.find((n) => n.id === selectedId)) {
      setSelectedId(null);
      setSelectedNote(null);
    }
  }, [notes, selectedId]);

  // -- Actions -------------------------------------------------------------
  function handleNoteCreated(id: string): void {
    refetch();
    loadNote(id);
  }

  function handleNoteSaved(): void {
    refetch();
    if (selectedId) loadNote(selectedId);
  }

  async function handleDelete(): Promise<void> {
    if (!selectedId) return;
    await deleteNotes([selectedId]);
    setSelectedId(null);
    setSelectedNote(null);
    setConfirmingDelete(false);
    refetch();
  }

  function handleBack(): void {
    setSelectedId(null);
    setSelectedNote(null);
  }

  // -- Keyboard shortcuts --------------------------------------------------
  useShortcut("n", "New note", () => setShowCreate(true), "Notes");

  // -- Mobile: show detail when selected -----------------------------------
  const showingDetail = !isDesktop && selectedId !== null;

  // -- Render --------------------------------------------------------------
  return (
    <div style={{
      display: "flex",
      height: "100%",
      overflow: "hidden",
    }}>
      {/* Left panel: note list */}
      {(!showingDetail) && (
        <div style={{
          width: isDesktop ? 320 : "100%",
          minWidth: isDesktop ? 320 : undefined,
          borderRight: isDesktop ? `1px solid ${t.colorBorder}` : "none",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          background: t.colorSurfacePanel,
        }}>
          {/* List header */}
          <div style={{ padding: `${t.spaceMd} ${t.spaceMd} 0` }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: t.spaceSm,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: t.spaceXs }}>
                <h1 style={{
                  fontSize: t.fontSizeLg,
                  fontWeight: t.fontWeightBold,
                  margin: 0,
                  color: t.colorText,
                }}>
                  Notes
                </h1>
                {total > 0 && (
                  <span style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
                    {total}
                  </span>
                )}
              </div>
              <IconButton
                icon="plus"
                size="sm"
                aria-label="New note"
                onClick={() => setShowCreate(true)}
              />
            </div>
            <SearchInput
              value={search}
              onSearch={setSearch}
              placeholder="Search notes..."
              debounceMs={200}
            />
          </div>

          {/* Note list */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: `${t.spaceSm} ${t.spaceSm}`,
          }}>
            {error && (
              <div style={{ color: t.colorError, fontSize: t.fontSizeSm, padding: t.spaceMd }}>{error}</div>
            )}

            {loading && notes.length === 0 && (
              <div style={{ padding: `0 ${t.spaceXs}` }}>
                <Stack gap="xs">
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </Stack>
              </div>
            )}

            {!loading && notes.length === 0 && (
              <EmptyState
                icon="edit"
                message={search ? "No notes match your search" : "No notes yet — write your first one"}
                action={!search ? (
                  <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                    New note
                  </Button>
                ) : undefined}
              />
            )}

            {notes.map((note, i) => (
              <NoteListItem
                key={note.id}
                note={note}
                index={i}
                selected={note.id === selectedId}
                onClick={() => loadNote(note.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Right panel: note detail */}
      {isDesktop ? (
        <div style={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
        }}>
          {loadingDetail && (
            <div style={{ padding: `${t.spaceXl} ${t.spaceLg}`, maxWidth: 720 }}>
              <Skeleton height={32} width="60%" />
              <div style={{ marginTop: t.spaceSm }}>
                <Skeleton height={16} width="40%" />
              </div>
              <div style={{ marginTop: t.spaceLg }}>
                <Skeleton height={200} />
              </div>
            </div>
          )}

          {!loadingDetail && selectedNote && (
            <NoteDetailPanel
              note={selectedNote}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )}

          {!loadingDetail && !selectedNote && notes.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: t.colorTextMuted,
              fontSize: t.fontSizeSm,
            }}>
              Select a note to view it
            </div>
          )}

          {!loading && notes.length === 0 && !selectedNote && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}>
              <EmptyState
                icon="edit"
                message="Your notes will appear here"
                action={
                  <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                    Write your first note
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : showingDetail && (
        <div style={{
          width: "100%",
          overflowY: "auto",
          height: "100%",
        }}>
          {/* Mobile toolbar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${t.spaceSm} ${t.spaceMd}`,
            borderBottom: `1px solid ${t.colorBorder}`,
            background: t.colorSurfacePanel,
          }}>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              ← Back
            </Button>
            <IconButton
              icon="plus"
              size="sm"
              aria-label="New note"
              onClick={() => setShowCreate(true)}
            />
          </div>

          {loadingDetail && (
            <div style={{ padding: `${t.spaceXl} ${t.spaceLg}` }}>
              <Skeleton height={32} width="60%" />
              <div style={{ marginTop: t.spaceLg }}>
                <Skeleton height={200} />
              </div>
            </div>
          )}

          {!loadingDetail && selectedNote && (
            <NoteDetailPanel
              note={selectedNote}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )}
        </div>
      )}

      {/* Overlays */}
      {showCreate && (
        <CreateNoteOverlay
          onClose={() => setShowCreate(false)}
          onCreated={handleNoteCreated}
        />
      )}

      {editing && selectedNote && (
        <EditNoteOverlay
          note={selectedNote}
          onClose={() => setEditing(false)}
          onSaved={handleNoteSaved}
        />
      )}

      {confirmingDelete && selectedNote && (
        <ConfirmDialog
          title="Delete this note?"
          message={`"${selectedNote.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
