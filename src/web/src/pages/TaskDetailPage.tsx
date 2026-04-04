import { useState, useEffect } from "react";
import { TASK_STATUSES, AREAS, EFFORT_LEVELS, RECURRENCE_TYPES } from "@domain/entities";
import type { ActivityLog, ScheduleSummary } from "@domain/entities";
import { useTask } from "../hooks";
import {
  updateTasks, completeTask,
  createNotes, createSchedules, updateSchedules, deleteSchedules,
  fetchSchedule,
} from "../api";
import {
  Button, Select, Textarea, Badge, StatusDot, Input,
  BackButton, Card, Stack,
  ModalShell,
  ContentCard, SectionHeading,
  MarkdownContent, stripMarkdown,
  useTheme,
} from "../components";
import { formatCompletionSummary } from "../utils";

// ---------------------------------------------------------------------------
// ScheduleOverlay
// ---------------------------------------------------------------------------

function ScheduleOverlay({ taskId, existing, onClose, onSaved }: {
  taskId: string;
  existing: ScheduleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const [recurrenceType, setRecurrenceType] = useState(existing?.recurrence_type ?? "weekly");
  const [nextDue, setNextDue] = useState(existing?.next_due ?? "");
  const [ruleJson, setRuleJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRule, setLoadingRule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch full schedule to get recurrence_rule when editing existing
  useEffect(() => {
    if (!existing) return;
    setLoadingRule(true);
    fetchSchedule(existing.id)
      .then((full) => {
        setRuleJson(full.recurrence_rule ?? "");
      })
      .catch(() => {
        // Graceful degradation: leave ruleJson empty
      })
      .finally(() => setLoadingRule(false));
  }, [existing]);

  async function handleSubmit(e: React.FormEvent) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth={400}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: theme.font.size.lg, fontWeight: 600, marginBottom: theme.spacing.lg, color: theme.color.text }}>
          {existing ? "Edit Schedule" : "Create Schedule"}
        </h3>
        <div style={{ marginBottom: theme.spacing.md }}>
          <Select
            label="Recurrence Type"
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value)}
          >
            {RECURRENCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: theme.spacing.md }}>
          <Input
            label="Next Due (YYYY-MM-DD)"
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: theme.spacing.sm }}>
          <Textarea
            label="Recurrence Rule (JSON, optional)"
            rows={2}
            placeholder={loadingRule ? "Loading..." : 'e.g. {"type":"weekly","days":[1,3,5]}'}
            value={ruleJson}
            onChange={(e) => setRuleJson(e.target.value)}
            disabled={loadingRule}
          />
        </div>
        {error && (
          <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: theme.spacing.xs }}>
            {error}
          </div>
        )}
        <Stack direction="row" justify="flex-end" gap="sm" style={{ marginTop: theme.spacing.md }}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" loading={busy}>Save</Button>
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
}) {
  const { theme } = useTheme();
  const [showOverlay, setShowOverlay] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ScheduleSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const schedule = schedules[0] ?? null;

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await deleteSchedules([id]);
      onRefetch();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "An unexpected error occurred");
    }
  }

  return (
    <>
      <SectionHeading>Schedule</SectionHeading>
      {schedule ? (
        <ContentCard variant="schedule">
          <div>
            <Badge variant="recurrence">{schedule.recurrence_type}</Badge>
            {schedule.next_due && (
              <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Next due: {schedule.next_due}</span>
            )}
          </div>
          {schedule.last_completed && (
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: theme.spacing.xs }}>
              Last completed: {schedule.last_completed}
            </div>
          )}
          <div style={{ marginTop: theme.spacing.sm }}>
            <Button variant="ghost" size="sm" onClick={() => { setEditSchedule(schedule); setShowOverlay(true); }}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleDelete(schedule.id)} style={{ marginLeft: theme.spacing.sm }}>
              Remove
            </Button>
          </div>
          {deleteError && (
            <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: theme.spacing.xs }}>
              {deleteError}
            </div>
          )}
        </ContentCard>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => { setEditSchedule(null); setShowOverlay(true); }}>
          + Add schedule
        </Button>
      )}
      {showOverlay && (
        <ScheduleOverlay
          taskId={taskId}
          existing={editSchedule}
          onClose={() => setShowOverlay(false)}
          onSaved={onRefetch}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// NotesSection
// ---------------------------------------------------------------------------

function NotesSection({ taskId, notes, onRefetch }: {
  taskId: string;
  notes: Array<{ id: string; title: string; content?: string | null; task_id?: string | null; note_type?: string }>;
  onRefetch: () => void;
}) {
  const { theme } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to manual notes only (completion notes appear in CompletionHistory)
  const manualNotes = notes.filter((n) => n.note_type !== "completion");

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createNotes([{ title: newTitle.trim(), content: newContent.trim() || undefined, task_id: taskId }]);
      setNewTitle("");
      setNewContent("");
      setShowAdd(false);
      onRefetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading count={manualNotes.length}>Notes</SectionHeading>
      {manualNotes.map((n) => (
        <ContentCard key={n.id} variant="note">
          <div style={{ fontWeight: 500 }}>{n.title}</div>
          {n.content && (
            n.content.length > 120
              ? <div style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: theme.spacing.xs }}>
                  {stripMarkdown(n.content).slice(0, 120) + "..."}
                </div>
              : <MarkdownContent content={n.content} style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: theme.spacing.xs }} />
          )}
        </ContentCard>
      ))}
      {!showAdd ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>+ Add note</Button>
      ) : (
        <Card style={{ background: theme.color.surfaceContainer }}>
          <div style={{ marginBottom: theme.spacing.sm }}>
            <Input
              placeholder="Note title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: theme.spacing.sm }}>
            <Textarea
              rows={2}
              placeholder="Content (optional)"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
          </div>
          {error && (
            <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: theme.spacing.xs }}>
              {error}
            </div>
          )}
          <Stack direction="row" gap="sm" style={{ marginTop: theme.spacing.xs }}>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={handleAdd}>Add Note</Button>
          </Stack>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CompletionHistory
// ---------------------------------------------------------------------------

function CompletionHistory({ history, notes }: {
  history: ActivityLog[];
  notes: Array<{ id: string; title: string; content?: string | null; note_type?: string }>;
}) {
  const { theme } = useTheme();

  if (history.length === 0) return null;

  // Build a map of note_id -> note for correlating completion entries with their notes
  const noteMap = new Map<string, typeof notes[number]>();
  for (const n of notes) {
    noteMap.set(n.id, n);
  }

  return (
    <>
      <SectionHeading count={history.length}>Completion History</SectionHeading>
      {history.map((entry) => {
        // Try to extract note_id from the activity log summary
        let noteId: string | null = null;
        try {
          const data = JSON.parse(entry.summary);
          noteId = data.note_id ?? null;
        } catch { /* ignore */ }
        const companionNote = noteId ? noteMap.get(noteId) ?? null : null;

        return (
          <div key={entry.id}>
            <ContentCard variant="history">
              <span>{formatCompletionSummary(entry.summary)}</span>
              <span style={{ marginLeft: theme.spacing.sm, color: theme.color.textFaint }}>
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </ContentCard>
            {companionNote && (
              <ContentCard variant="completion-note" style={{ marginLeft: theme.spacing.md, marginTop: 2 }}>
                <div style={{ fontWeight: 500, fontSize: theme.font.size.xs }}>{companionNote.title}</div>
                {companionNote.content && (
                  companionNote.content.length > 120
                    ? <div style={{ fontSize: theme.font.size.xxs, color: theme.color.textFaint, marginTop: 2 }}>
                        {stripMarkdown(companionNote.content).slice(0, 120) + "..."}
                      </div>
                    : <MarkdownContent content={companionNote.content} style={{ fontSize: theme.font.size.xxs, color: theme.color.textFaint, marginTop: 2 }} />
                )}
              </ContentCard>
            )}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailPage
// ---------------------------------------------------------------------------

export function TaskDetailPage({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { theme } = useTheme();
  const { task, schedules, notes, completionHistory, loading, error, refetch } = useTask(taskId);

  // Inline editing state
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editArea, setEditArea] = useState<string | null>(null);
  const [editEffort, setEditEffort] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [showCompletionNote, setShowCompletionNote] = useState(false);

  if (loading && !task) {
    return (
      <div style={{ textAlign: "center", padding: `${theme.spacing["2xl"]} ${theme.spacing.lg}`, color: theme.color.textMuted }}>
        Loading task...
      </div>
    );
  }
  if (error && !task) {
    return (
      <div style={{ textAlign: "center", padding: `${theme.spacing.xl} ${theme.spacing.lg}`, color: theme.color.danger }}>
        {error}
      </div>
    );
  }
  if (!task) return null;

  const currentTitle = editTitle ?? task.title;
  const currentDesc = editDesc ?? (task.description ?? "");
  const currentStatus = editStatus ?? task.status;
  const currentArea = editArea ?? (task.area ?? "");
  const currentEffort = editEffort ?? (task.effort ?? "");

  const hasChanges =
    editTitle !== null ||
    editDesc !== null ||
    editStatus !== null ||
    editArea !== null ||
    editEffort !== null;

  async function handleSave() {
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
      setEditTitle(null);
      setEditDesc(null);
      setEditStatus(null);
      setEditArea(null);
      setEditEffort(null);
      refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setCompleteError(null);
    setCompleting(true);
    try {
      await completeTask(taskId, completionNote || undefined);
      setCompletionNote("");
      setShowCompletionNote(false);
      refetch();
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div style={{
      width: "100%",
      maxWidth: 640,
      margin: "0 auto",
      padding: `${theme.spacing.xl} ${theme.spacing.lg}`,
    }}>
      <BackButton onClick={onBack} label="Back to Tasks" style={{ marginBottom: theme.spacing.lg }} />

      {/* Title (editable) -- raw input styled as heading per plan */}
      <input
        style={{
          fontSize: theme.font.size.xl,
          fontWeight: 600,
          marginBottom: theme.spacing.xs,
          outline: "none",
          cursor: "text",
          border: "none",
          borderBottom: "2px solid transparent",
          width: "100%",
          background: "transparent",
          color: theme.color.text,
          fontFamily: theme.font.headline,
        }}
        value={currentTitle}
        onChange={(e) => setEditTitle(e.target.value)}
      />

      {/* Status, Area, Effort selects */}
      <div style={{ marginTop: theme.spacing.md, display: "flex", flexWrap: "wrap", gap: theme.spacing.sm, alignItems: "center" }}>
        <StatusDot status={currentStatus} />
        <Select value={currentStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ width: "auto", minWidth: 100 }}>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </Select>
        <Select value={currentArea} onChange={(e) => setEditArea(e.target.value)} style={{ width: "auto", minWidth: 120 }}>
          <option value="">No area</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </Select>
        <Select value={currentEffort} onChange={(e) => setEditEffort(e.target.value)} style={{ width: "auto", minWidth: 100 }}>
          <option value="">No effort</option>
          {EFFORT_LEVELS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
      </div>

      {/* Description */}
      <SectionHeading>Description</SectionHeading>
      <Textarea
        rows={4}
        placeholder="Add a description..."
        value={currentDesc}
        onChange={(e) => setEditDesc(e.target.value)}
      />

      {/* Save button */}
      {hasChanges && (
        <Button
          variant="primary"
          loading={saving}
          onClick={handleSave}
          style={{ marginTop: theme.spacing.sm }}
        >
          Save Changes
        </Button>
      )}
      {saveError && (
        <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: theme.spacing.xs }}>
          {saveError}
        </div>
      )}

      {/* Mark Done */}
      <SectionHeading>Completion</SectionHeading>
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
        <Button
          variant="ghost"
          loading={completing}
          onClick={handleComplete}
          style={{ color: theme.color.success, borderColor: theme.color.success }}
        >
          Mark Done
        </Button>
        {!showCompletionNote && (
          <Button variant="ghost" size="sm" onClick={() => setShowCompletionNote(true)}>+ note</Button>
        )}
      </div>
      {completeError && (
        <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: theme.spacing.xs }}>
          {completeError}
        </div>
      )}
      {showCompletionNote && (
        <Textarea
          rows={2}
          placeholder="Completion note..."
          value={completionNote}
          onChange={(e) => setCompletionNote(e.target.value)}
          autoFocus
          style={{ marginTop: theme.spacing.sm }}
        />
      )}

      {/* Schedule */}
      <ScheduleSection taskId={taskId} schedules={schedules} onRefetch={refetch} />

      {/* Notes */}
      <NotesSection taskId={taskId} notes={notes} onRefetch={refetch} />

      {/* Completion History */}
      <CompletionHistory history={completionHistory} notes={notes} />
    </div>
  );
}
