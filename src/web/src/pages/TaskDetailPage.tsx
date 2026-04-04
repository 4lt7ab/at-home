import { useState, useEffect } from "react";
import { TASK_STATUSES, AREAS, EFFORT_LEVELS, RECURRENCE_TYPES } from "@domain/entities";
import type { ActivityLog, ScheduleSummary } from "@domain/entities";
import { useTask } from "../hooks";
import {
  updateTasks, completeTask,
  createNotes, createSchedules, updateSchedules, deleteSchedules,
  fetchSchedule,
} from "../api";
import { StatusDot } from "../components/StatusDot";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    width: "100%",
    maxWidth: 640,
    margin: "0 auto",
    padding: "24px 16px",
  } as React.CSSProperties,

  backBtn: {
    fontSize: 13,
    color: "var(--color-accent)",
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: 0,
    marginBottom: 16,
    display: "inline-block",
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 4,
    outline: "none",
    cursor: "text",
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginTop: 24,
    marginBottom: 8,
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

  select: {
    fontSize: 13,
    padding: "4px 8px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    background: "var(--color-surface)",
    color: "var(--color-text)",
    marginRight: 8,
  } as React.CSSProperties,

  descriptionBox: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    fontFamily: "inherit",
    resize: "vertical" as const,
    lineHeight: 1.5,
    minHeight: 60,
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  saveBtn: {
    fontSize: 13,
    padding: "6px 14px",
    border: "1px solid var(--color-success)",
    borderRadius: 6,
    background: "var(--color-success)",
    color: "var(--color-btn-text)",
    cursor: "pointer",
    marginTop: 8,
  } as React.CSSProperties,

  doneBtn: {
    fontSize: 14,
    padding: "8px 20px",
    border: "1px solid var(--color-success)",
    borderRadius: 6,
    background: "var(--color-surface)",
    color: "var(--color-success)",
    cursor: "pointer",
    fontWeight: 500,
  } as React.CSSProperties,

  card: {
    padding: "10px 12px",
    marginBottom: 6,
    borderRadius: 4,
    background: "var(--color-surface-alt)",
    border: "1px solid var(--color-border-lighter)",
    fontSize: 13,
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    fontFamily: "inherit",
    marginBottom: 8,
    background: "var(--color-surface)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  link: {
    fontSize: 13,
    color: "var(--color-accent)",
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: 0,
    textDecoration: "underline",
  } as React.CSSProperties,

  historyItem: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    padding: "4px 0",
    borderBottom: "1px solid var(--color-border-lightest)",
  } as React.CSSProperties,

  error: {
    textAlign: "center" as const,
    padding: "24px 16px",
    color: "var(--color-danger)",
  } as React.CSSProperties,

  loading: {
    textAlign: "center" as const,
    padding: "48px 16px",
    color: "var(--color-text-muted)",
  } as React.CSSProperties,

  dangerBtn: {
    fontSize: 12,
    padding: "4px 10px",
    border: "1px solid var(--color-danger-bright)",
    borderRadius: 4,
    background: "var(--color-surface)",
    color: "var(--color-danger-bright)",
    cursor: "pointer",
    marginLeft: 8,
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

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
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

  submitBtn: {
    fontSize: 13,
    padding: "6px 14px",
    border: "1px solid var(--color-accent)",
    borderRadius: 6,
    background: "var(--color-accent)",
    color: "var(--color-btn-text)",
    cursor: "pointer",
  } as React.CSSProperties,
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--color-success)", bg: "var(--color-success-bg)" },
  paused: { color: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  done: { color: "var(--color-text-muted)", bg: "var(--color-muted-bg)" },
  archived: { color: "var(--color-text-faintest)", bg: "var(--color-bg)" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompletionSummary(summary: string): string {
  try {
    const data = JSON.parse(summary);
    const parts: string[] = [];
    if (data.next_due) parts.push(`next due: ${data.next_due}`);
    else if (data.next_due === null) parts.push("schedule complete");
    if (data.last_completed) parts.push(`completed: ${data.last_completed}`);
    return parts.length > 0 ? "Completed \u2014 " + parts.join(", ") : "Completed";
  } catch {
    return summary;
  }
}

// ---------------------------------------------------------------------------
// ScheduleSection
// ---------------------------------------------------------------------------

function ScheduleOverlay({ taskId, existing, onClose, onSaved }: {
  taskId: string;
  existing: ScheduleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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
    <div style={s.overlay} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {existing ? "Edit Schedule" : "Create Schedule"}
        </h3>
        <label style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Recurrence Type</label>
        <select
          style={{ ...s.select, width: "100%", marginBottom: 12 }}
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value)}
        >
          {RECURRENCE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Next Due (YYYY-MM-DD)</label>
        <input
          type="date"
          style={s.input}
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
        />

        <label style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Recurrence Rule (JSON, optional)</label>
        <textarea
          style={{ ...s.descriptionBox, minHeight: 40, marginBottom: 0 }}
          rows={2}
          placeholder={loadingRule ? "Loading..." : 'e.g. {"type":"weekly","days":[1,3,5]}'}
          value={ruleJson}
          onChange={(e) => setRuleJson(e.target.value)}
          disabled={loadingRule}
        />

        {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{error}</div>}
        <div style={s.formActions}>
          <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...s.submitBtn, opacity: busy ? 0.5 : 1 }} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ScheduleSection({ taskId, schedules, onRefetch }: {
  taskId: string;
  schedules: ScheduleSummary[];
  onRefetch: () => void;
}) {
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
      <h3 style={s.sectionLabel}>Schedule</h3>
      {schedule ? (
        <div style={s.card}>
          <div>
            <span style={s.badge("var(--color-area)", "var(--color-area-bg)")}>{schedule.recurrence_type}</span>
            {schedule.next_due && (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Next due: {schedule.next_due}</span>
            )}
          </div>
          {schedule.last_completed && (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              Last completed: {schedule.last_completed}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button style={s.link} onClick={() => { setEditSchedule(schedule); setShowOverlay(true); }}>
              Edit
            </button>
            <button style={s.dangerBtn} onClick={() => handleDelete(schedule.id)}>
              Remove
            </button>
          </div>
          {deleteError && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{deleteError}</div>}
        </div>
      ) : (
        <button style={s.link} onClick={() => { setEditSchedule(null); setShowOverlay(true); }}>
          + Add schedule
        </button>
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
  notes: Array<{ id: string; title: string; content?: string | null; task_id?: string | null }>;
  onRefetch: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <h3 style={s.sectionLabel}>Notes ({notes.length})</h3>
      {notes.map((n) => (
        <div key={n.id} style={s.card}>
          <div style={{ fontWeight: 500 }}>{n.title}</div>
          {n.content && (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              {n.content.length > 120 ? n.content.slice(0, 120) + "..." : n.content}
            </div>
          )}
        </div>
      ))}
      {!showAdd ? (
        <button style={s.link} onClick={() => setShowAdd(true)}>+ Add note</button>
      ) : (
        <div style={{ ...s.card, background: "var(--color-surface)" }}>
          <input
            style={s.input}
            placeholder="Note title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <textarea
            style={{ ...s.descriptionBox, minHeight: 40 }}
            rows={2}
            placeholder="Content (optional)"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={s.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={{ ...s.submitBtn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={handleAdd}>
              {busy ? "Adding..." : "Add Note"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CompletionHistory
// ---------------------------------------------------------------------------

function CompletionHistory({ history }: { history: ActivityLog[] }) {
  if (history.length === 0) return null;
  return (
    <>
      <h3 style={s.sectionLabel}>Completion History</h3>
      {history.map((entry) => (
        <div key={entry.id} style={s.historyItem}>
          <span>{formatCompletionSummary(entry.summary)}</span>
          <span style={{ marginLeft: 8, color: "var(--color-text-faintest)" }}>
            {new Date(entry.created_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailPage
// ---------------------------------------------------------------------------

export function TaskDetailPage({ taskId, onBack }: { taskId: string; onBack: () => void }) {
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

  if (loading && !task) return <div style={s.loading}>Loading task...</div>;
  if (error && !task) return <div style={s.error}>{error}</div>;
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
    <div style={s.page}>
      <button style={s.backBtn} onClick={onBack}>&larr; Back to Tasks</button>

      {/* Title (editable) */}
      <input
        style={{ ...s.title, border: "none", borderBottom: "2px solid transparent", width: "100%", background: "transparent", color: "var(--color-text)" }}
        value={currentTitle}
        onChange={(e) => setEditTitle(e.target.value)}
      />

      {/* Status, Area, Effort selects */}
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StatusDot status={currentStatus} />
        <select style={s.select} value={currentStatus} onChange={(e) => setEditStatus(e.target.value)}>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <select style={s.select} value={currentArea} onChange={(e) => setEditArea(e.target.value)}>
          <option value="">No area</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select style={s.select} value={currentEffort} onChange={(e) => setEditEffort(e.target.value)}>
          <option value="">No effort</option>
          {EFFORT_LEVELS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <h3 style={s.sectionLabel}>Description</h3>
      <textarea
        style={s.descriptionBox}
        rows={4}
        placeholder="Add a description..."
        value={currentDesc}
        onChange={(e) => setEditDesc(e.target.value)}
      />

      {/* Save button */}
      {hasChanges && (
        <button
          style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      )}
      {saveError && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{saveError}</div>}

      {/* Mark Done */}
      <h3 style={s.sectionLabel}>Completion</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          style={{ ...s.doneBtn, opacity: completing ? 0.5 : 1 }}
          disabled={completing}
          onClick={handleComplete}
        >
          {completing ? "Completing..." : "Mark Done"}
        </button>
        {!showCompletionNote && (
          <button style={s.link} onClick={() => setShowCompletionNote(true)}>+ note</button>
        )}
      </div>
      {completeError && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{completeError}</div>}
      {showCompletionNote && (
        <textarea
          style={{ ...s.descriptionBox, marginTop: 8, minHeight: 40 }}
          rows={2}
          placeholder="Completion note..."
          value={completionNote}
          onChange={(e) => setCompletionNote(e.target.value)}
          autoFocus
        />
      )}

      {/* Schedule */}
      <ScheduleSection taskId={taskId} schedules={schedules} onRefetch={refetch} />

      {/* Notes */}
      <NotesSection taskId={taskId} notes={notes} onRefetch={refetch} />

      {/* Completion History */}
      <CompletionHistory history={completionHistory} />
    </div>
  );
}
