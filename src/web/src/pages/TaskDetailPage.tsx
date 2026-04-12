import { useState, useEffect } from "react";
import {
  semantic as t, Card, Badge, Button, Stack, Skeleton, EmptyState,
  Input, Select, Textarea, ModalShell, StatusDot,
} from "@4lt7ab/ui/ui";
import { TASK_STATUSES, AREAS, EFFORT_LEVELS, RECURRENCE_TYPES } from "@domain/entities";
import type { ActivityLog, ScheduleSummary } from "@domain/entities";
import { useTask } from "../hooks";
import {
  updateTasks, completeTask,
  createNotes, createSchedules, updateSchedules, deleteSchedules,
  fetchSchedule,
} from "../api";
import { formatCompletionSummary } from "../utils";

// ---------------------------------------------------------------------------
// ScheduleOverlay
// ---------------------------------------------------------------------------

function ScheduleOverlay({ taskId, existing, onClose, onSaved }: {
  taskId: string;
  existing: ScheduleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const [recurrenceType, setRecurrenceType] = useState(existing?.recurrence_type ?? "weekly");
  const [nextDue, setNextDue] = useState(existing?.next_due ?? "");
  const [ruleJson, setRuleJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRule, setLoadingRule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setLoadingRule(true);
    fetchSchedule(existing.id)
      .then((full) => setRuleJson(full.recurrence_rule ?? ""))
      .catch(() => {})
      .finally(() => setLoadingRule(false));
  }, [existing]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (existing) {
        await updateSchedules([{
          id: existing.id,
          recurrence_type: recurrenceType,
          next_due: nextDue || null,
          recurrence_rule: ruleJson || undefined,
        }]);
      } else {
        await createSchedules([{
          task_id: taskId,
          recurrence_type: recurrenceType,
          next_due: nextDue || undefined,
          recurrence_rule: ruleJson || undefined,
        }]);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>
          {existing ? "Edit Schedule" : "Add Schedule"}
        </h3>
        <Stack gap="sm">
          <Select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
            {RECURRENCE_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
          </Select>
          <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} placeholder="Next due" />
          <Textarea
            rows={2}
            placeholder={loadingRule ? "Loading..." : 'Recurrence rule JSON (optional)'}
            value={ruleJson}
            onChange={(e) => setRuleJson(e.target.value)}
            disabled={loadingRule}
          />
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <Stack direction="row" gap="sm" style={{ marginTop: t.spaceLg, justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// ScheduleSection
// ---------------------------------------------------------------------------

function ScheduleSection({ taskId, schedules, onRefetch }: {
  taskId: string;
  schedules: ScheduleSummary[];
  onRefetch: () => void;
}): React.JSX.Element {
  const [showOverlay, setShowOverlay] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ScheduleSummary | null>(null);

  const schedule = schedules[0] ?? null;

  async function handleDelete(id: string): Promise<void> {
    await deleteSchedules([id]);
    onRefetch();
  }

  return (
    <section style={{ marginTop: t.spaceXl }}>
      <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceSm }}>Schedule</h2>
      {schedule ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm, flexWrap: "wrap" }}>
            <Badge variant="secondary">{schedule.recurrence_type}</Badge>
            {schedule.next_due && <span style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>Next due: {schedule.next_due}</span>}
          </div>
          {schedule.last_completed && (
            <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
              Last completed: {schedule.last_completed}
            </div>
          )}
          <Stack direction="row" gap="xs" style={{ marginTop: t.spaceSm }}>
            <Button variant="secondary" size="sm" onClick={() => { setEditSchedule(schedule); setShowOverlay(true); }}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(schedule.id)}>Remove</Button>
          </Stack>
        </Card>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => { setEditSchedule(null); setShowOverlay(true); }}>+ Add schedule</Button>
      )}
      {showOverlay && (
        <ScheduleOverlay taskId={taskId} existing={editSchedule} onClose={() => setShowOverlay(false)} onSaved={onRefetch} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// NotesSection
// ---------------------------------------------------------------------------

function NotesSection({ taskId, notes, onRefetch }: {
  taskId: string;
  notes: Array<{ id: string; title: string; content?: string | null; note_type?: string }>;
  onRefetch: () => void;
}): React.JSX.Element {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);

  const manualNotes = notes.filter((n) => n.note_type !== "completion");

  async function handleAdd(): Promise<void> {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await createNotes([{ title: newTitle.trim(), content: newContent.trim() || undefined, task_id: taskId }]);
      setNewTitle("");
      setNewContent("");
      setShowAdd(false);
      onRefetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: t.spaceXl }}>
      <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceSm }}>
        Notes {manualNotes.length > 0 && <Badge variant="secondary">{manualNotes.length}</Badge>}
      </h2>
      <Stack gap="sm">
        {manualNotes.map((n) => (
          <Card key={n.id}>
            <div style={{ fontWeight: 500 }}>{n.title}</div>
            {n.content && (
              <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
                {n.content.length > 200 ? n.content.slice(0, 200) + "..." : n.content}
              </div>
            )}
          </Card>
        ))}
      </Stack>
      {!showAdd ? (
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)} style={{ marginTop: t.spaceSm }}>+ Add note</Button>
      ) : (
        <Card style={{ marginTop: t.spaceSm }}>
          <Stack gap="sm">
            <Input placeholder="Note title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
            <Textarea rows={2} placeholder="Content (optional)" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
            <Stack direction="row" gap="sm">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAdd} disabled={busy}>{busy ? "Adding..." : "Add"}</Button>
            </Stack>
          </Stack>
        </Card>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CompletionHistory
// ---------------------------------------------------------------------------

function CompletionHistory({ history, notes }: {
  history: ActivityLog[];
  notes: Array<{ id: string; title: string; content?: string | null; note_type?: string }>;
}): React.JSX.Element | null {
  if (history.length === 0) return null;

  const noteMap = new Map<string, (typeof notes)[number]>();
  for (const n of notes) noteMap.set(n.id, n);

  return (
    <section style={{ marginTop: t.spaceXl }}>
      <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceSm }}>
        Completion History <Badge variant="secondary">{history.length}</Badge>
      </h2>
      <Stack gap="xs">
        {history.map((entry) => {
          let noteId: string | null = null;
          try { noteId = JSON.parse(entry.summary).note_id ?? null; } catch { /* */ }
          const note = noteId ? noteMap.get(noteId) ?? null : null;

          return (
            <Card key={entry.id}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: t.fontSizeSm }}>
                <span>{formatCompletionSummary(entry.summary)}</span>
                <span style={{ color: t.colorTextMuted, fontSize: t.fontSizeXs }}>
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
              {note && (
                <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs, paddingLeft: t.spaceSm, borderLeft: `2px solid ${t.colorBorder}` }}>
                  {note.title}{note.content ? ` — ${note.content.slice(0, 100)}` : ""}
                </div>
              )}
            </Card>
          );
        })}
      </Stack>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailPage
// ---------------------------------------------------------------------------

export function TaskDetailPage({ taskId, onBack }: { taskId: string; onBack: () => void }): React.JSX.Element {
  const { task, schedules, notes, completionHistory, loading, error, refetch } = useTask(taskId);

  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editArea, setEditArea] = useState<string | null>(null);
  const [editEffort, setEditEffort] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [showCompletionNote, setShowCompletionNote] = useState(false);

  if (loading && !task) {
    return <PageShell><Stack gap="md"><Skeleton height={40} /><Skeleton height={200} /></Stack></PageShell>;
  }
  if (error && !task) {
    return <PageShell><EmptyState icon="error" message="Failed to load task">{error}</EmptyState></PageShell>;
  }
  if (!task) return <PageShell><EmptyState icon="search" message="Task not found" /></PageShell>;

  const currentTitle = editTitle ?? task.title;
  const currentDesc = editDesc ?? (task.description ?? "");
  const currentStatus = editStatus ?? task.status;
  const currentArea = editArea ?? (task.area ?? "");
  const currentEffort = editEffort ?? (task.effort ?? "");
  const hasChanges = editTitle !== null || editDesc !== null || editStatus !== null || editArea !== null || editEffort !== null;

  async function handleSave(): Promise<void> {
    setSaveError(null);
    setSaving(true);
    const updates: Record<string, unknown> = { id: taskId };
    if (editTitle !== null) updates.title = editTitle;
    if (editDesc !== null) updates.description = editDesc || null;
    if (editStatus !== null) updates.status = editStatus;
    if (editArea !== null) updates.area = editArea || null;
    if (editEffort !== null) updates.effort = editEffort || null;
    try {
      await updateTasks([updates as never]);
      setEditTitle(null); setEditDesc(null); setEditStatus(null); setEditArea(null); setEditEffort(null);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(): Promise<void> {
    setCompleting(true);
    try {
      await completeTask(taskId, completionNote || undefined);
      setCompletionNote("");
      setShowCompletionNote(false);
      refetch();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <PageShell>
      <Button variant="secondary" size="sm" onClick={onBack} style={{ marginBottom: t.spaceLg }}>
        &larr; Back to Tasks
      </Button>

      {/* Title */}
      <input
        style={{
          fontSize: t.fontSize2xl,
          fontWeight: 700,
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `2px solid transparent`,
          outline: "none",
          color: t.colorText,
          fontFamily: t.fontSans,
          padding: `${t.spaceXs} 0`,
        }}
        value={currentTitle}
        onChange={(e) => setEditTitle(e.target.value)}
      />

      {/* Status / Area / Effort */}
      <Stack direction="row" gap="sm" style={{ marginTop: t.spaceMd, flexWrap: "wrap", alignItems: "center" }}>
        <StatusDot status={currentStatus} color={statusColor(currentStatus)} size="sm" />
        <Select style={{ width: "auto" }} value={currentStatus} onChange={(e) => setEditStatus(e.target.value)}>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select style={{ width: "auto" }} value={currentArea} onChange={(e) => setEditArea(e.target.value)}>
          <option value="">No area</option>
          {AREAS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </Select>
        <Select style={{ width: "auto" }} value={currentEffort} onChange={(e) => setEditEffort(e.target.value)}>
          <option value="">No effort</option>
          {EFFORT_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </Stack>

      {/* Description */}
      <section style={{ marginTop: t.spaceXl }}>
        <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceSm }}>Description</h2>
        <Textarea rows={4} placeholder="Add a description..." value={currentDesc} onChange={(e) => setEditDesc(e.target.value)} />
      </section>

      {/* Save */}
      {hasChanges && (
        <Button variant="primary" onClick={handleSave} disabled={saving} style={{ marginTop: t.spaceSm }}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      )}
      {saveError && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{saveError}</div>}

      {/* Mark Done */}
      <section style={{ marginTop: t.spaceXl }}>
        <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceSm }}>Completion</h2>
        <Stack direction="row" gap="sm" style={{ alignItems: "center" }}>
          <Button variant="primary" onClick={handleComplete} disabled={completing}>
            {completing ? "..." : "Mark Done"}
          </Button>
          {!showCompletionNote && (
            <Button variant="secondary" size="sm" onClick={() => setShowCompletionNote(true)}>+ note</Button>
          )}
        </Stack>
        {showCompletionNote && (
          <Textarea
            rows={2}
            placeholder="Completion note..."
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            autoFocus
            style={{ marginTop: t.spaceSm }}
          />
        )}
      </section>

      <ScheduleSection taskId={taskId} schedules={schedules} onRefetch={refetch} />
      <NotesSection taskId={taskId} notes={notes} onRefetch={refetch} />
      <CompletionHistory history={completionHistory} notes={notes} />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "active": return "green";
    case "paused": return "yellow";
    case "done": return "blue";
    case "archived": return "gray";
    default: return "gray";
  }
}

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: `${t.spaceXl} ${t.spaceLg}` }}>
      {children}
    </div>
  );
}
