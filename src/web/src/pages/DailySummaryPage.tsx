import { useState, useEffect, useCallback } from "react";
import type { DailySummaryItem } from "@domain/summary";
import type { HomeTask, Note, ScheduleSummary, ActivityLog } from "@domain/entities";
import { useDailySummary } from "../hooks";
import { completeTask, fetchTask, fetchSchedules, fetchNotes, fetchNote, fetchActivityLog } from "../api";
import { StatusDot } from "../components/StatusDot";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  page: {
    width: "100%",
    maxWidth: 640,
    margin: "0 auto",
    padding: "24px 16px",
  } as React.CSSProperties,

  dateHeader: {
    fontSize: 14,
    color: "var(--color-text-secondary)",
    marginBottom: 24,
    textAlign: "center" as const,
  } as React.CSSProperties,

  sectionTitle: (variant: "danger" | "primary" | "muted") => ({
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    padding: "8px 0",
    marginTop: 16,
    marginBottom: 8,
    borderBottom: "1px solid var(--color-border)",
    color: variant === "danger" ? "var(--color-danger)" : variant === "primary" ? "var(--color-text)" : "var(--color-text-muted)",
  }),

  item: {
    padding: "12px 0",
    borderBottom: "1px solid var(--color-border-lightest)",
  } as React.CSSProperties,

  itemHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  } as React.CSSProperties,

  title: {
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
    whiteSpace: "nowrap" as const,
  }),

  meta: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    marginTop: 4,
  } as React.CSSProperties,

  overdueBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
    color: "var(--color-btn-text)",
    background: "var(--color-danger)",
    marginRight: 6,
  } as React.CSSProperties,

  markDoneBtn: {
    fontSize: 13,
    padding: "6px 14px",
    border: "1px solid var(--color-success)",
    borderRadius: 6,
    background: "var(--color-surface)",
    color: "var(--color-success)",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  } as React.CSSProperties,

  markDoneBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  noteInput: {
    width: "100%",
    marginTop: 8,
    padding: "6px 8px",
    border: "1px solid var(--color-input-border)",
    borderRadius: 4,
    fontSize: 13,
    resize: "vertical" as const,
    fontFamily: "inherit",
  } as React.CSSProperties,

  addNoteLink: {
    fontSize: 12,
    color: "var(--color-accent)",
    cursor: "pointer",
    marginTop: 4,
    display: "inline-block",
    border: "none",
    background: "none",
    padding: 0,
    textDecoration: "underline",
  } as React.CSSProperties,

  emptyState: {
    textAlign: "center" as const,
    padding: "48px 16px",
    color: "var(--color-text-faint)",
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

  notesPreview: {
    fontSize: 12,
    color: "var(--color-text-faint)",
    marginTop: 2,
    fontStyle: "italic" as const,
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
    maxWidth: 520,
    maxHeight: "80vh",
    overflowY: "auto" as const,
    boxShadow: "0 4px 24px var(--color-shadow)",
    color: "var(--color-text)",
  } as React.CSSProperties,

  overlayTitle: {
    fontSize: 18,
    fontWeight: 600,
  } as React.CSSProperties,

  overlaySection: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginTop: 20,
    marginBottom: 8,
  } as React.CSSProperties,

  overlayCard: {
    padding: "10px 12px",
    marginBottom: 6,
    borderRadius: 4,
    background: "var(--color-surface-alt)",
    border: "1px solid var(--color-border-lighter)",
    fontSize: 13,
  } as React.CSSProperties,

  closeBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    color: "var(--color-text-muted)",
    fontSize: 18,
    padding: 4,
    lineHeight: 1,
  } as React.CSSProperties,
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
// MarkDoneButton
// ---------------------------------------------------------------------------

function MarkDoneButton({ taskId, onComplete }: { taskId: string; onComplete: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDone() {
    setError(null);
    setBusy(true);
    try {
      await completeTask(taskId, note || undefined);
      setNote("");
      setShowNote(false);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button
        style={{ ...styles.markDoneBtn, ...(busy ? styles.markDoneBtnDisabled : {}) }}
        disabled={busy}
        onClick={handleDone}
      >
        {busy ? "..." : "Done"}
      </button>
      {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4, textAlign: "right" }}>{error}</div>}
      {!showNote && (
        <button style={styles.addNoteLink} onClick={() => setShowNote(true)}>
          + note
        </button>
      )}
      {showNote && (
        <textarea
          style={{ ...styles.noteInput, maxWidth: 200 }}
          rows={2}
          placeholder="Completion note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailOverlay
// ---------------------------------------------------------------------------

function TaskDetailOverlay({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<HomeTask | null>(null);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [completionHistory, setCompletionHistory] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchTask(taskId),
      fetchSchedules({ task_id: taskId }),
      fetchNotes({ task_id: taskId }),
      fetchActivityLog({ entity_type: "home_task", entity_id: taskId, limit: 20 }),
    ])
      .then(async ([taskData, schedulesData, notesData, activityData]) => {
        setTask(taskData);
        setSchedules(schedulesData.data);
        // Fetch full notes individually (list endpoint returns NoteSummary without content)
        const noteSlice = notesData.data.slice(0, 5);
        if (noteSlice.length > 0) {
          try {
            const fullNotes = await Promise.all(noteSlice.map((n) => fetchNote(n.id)));
            setNotes(fullNotes);
          } catch {
            // Fall back to summary data if individual fetches fail
            setNotes(noteSlice as unknown as Note[]);
          }
        }
        setCompletionHistory(activityData.data.filter((a) => a.action === "completed"));
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load task");
        setLoading(false);
      });
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const schedule = schedules[0] ?? null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-text-muted)" }}>
            Loading task details...
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        {!loading && !error && task && (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={styles.overlayTitle}>{task.title}</div>
              <button style={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
            </div>

            {/* Badges */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <StatusDot status={task.status} />
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{task.status}</span>
              {task.area && (
                <span style={styles.badge("var(--color-area)", "var(--color-area-bg)")}>{task.area.replace(/_/g, " ")}</span>
              )}
              {task.effort && (
                <span style={styles.badge("var(--color-text-secondary)", "var(--color-muted-bg)")}>{task.effort}</span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <>
                <div style={styles.overlaySection}>Description</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--color-text)" }}>
                  {task.description}
                </div>
              </>
            )}

            {/* Schedule */}
            {schedule && (
              <>
                <div style={styles.overlaySection}>Schedule</div>
                <div style={styles.overlayCard}>
                  <div>
                    <span style={styles.badge("var(--color-area)", "var(--color-area-bg)")}>{schedule.recurrence_type}</span>
                    {schedule.next_due && (
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Next due: {schedule.next_due}</span>
                    )}
                  </div>
                  {schedule.last_completed && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                      Last completed: {schedule.last_completed}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            {notes.length > 0 && (
              <>
                <div style={styles.overlaySection}>Notes ({notes.length})</div>
                {notes.map((n) => (
                  <div key={n.id} style={styles.overlayCard}>
                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                    {n.content && (
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                        {n.content.length > 200 ? n.content.slice(0, 200) + "..." : n.content}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Completion History */}
            {completionHistory.length > 0 && (
              <>
                <div style={styles.overlaySection}>Completion History</div>
                {completionHistory.map((entry) => (
                  <div key={entry.id} style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "4px 0", borderBottom: "1px solid var(--color-border-lightest)" }}>
                    <span>{formatCompletionSummary(entry.summary)}</span>
                    <span style={{ marginLeft: 8, color: "var(--color-text-faintest)" }}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryItem
// ---------------------------------------------------------------------------

function SummaryItem({ item, variant, onComplete, onItemClick }: {
  item: DailySummaryItem;
  variant: "danger" | "primary" | "muted";
  onComplete: () => void;
  onItemClick: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.item}>
      <div style={styles.itemHeader}>
        <div
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onClick={() => onItemClick(item.task.id)}
          onKeyDown={(e) => e.key === "Enter" && onItemClick(item.task.id)}
        >
          <div style={{ ...styles.title, display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot
              status={item.task.status}
              color={variant === "danger" ? "var(--color-danger)" : variant === "primary" ? "var(--color-success)" : "var(--color-text-muted)"}
            />
            {item.task.title}
          </div>
          <div style={{ marginTop: 4 }}>
            {item.task.area && (
              <span style={styles.badge("var(--color-area)", "var(--color-area-bg)")}>{item.task.area.replace(/_/g, " ")}</span>
            )}
            {item.recurrence_label && (
              <span style={styles.badge("var(--color-text-secondary)", "var(--color-muted-bg)")}>{item.recurrence_label}</span>
            )}
            {variant === "danger" && item.days_overdue > 0 && (
              <span style={styles.overdueBadge}>{item.days_overdue}d overdue</span>
            )}
          </div>
          {item.schedule.next_due && variant === "muted" && (
            <div style={styles.meta}>Due: {item.schedule.next_due}</div>
          )}
          {item.notes.length > 0 && (
            <button
              style={styles.addNoteLink}
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? "hide" : `${item.notes.length} note${item.notes.length > 1 ? "s" : ""}`}
            </button>
          )}
          {expanded && item.notes.map((n) => (
            <div key={n.id} style={styles.notesPreview}>{n.title}</div>
          ))}
        </div>
        <MarkDoneButton taskId={item.task.id} onComplete={onComplete} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummarySection
// ---------------------------------------------------------------------------

function SummarySection({ title, variant, items, onComplete, onItemClick }: {
  title: string;
  variant: "danger" | "primary" | "muted";
  items: DailySummaryItem[];
  onComplete: () => void;
  onItemClick: (taskId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 style={styles.sectionTitle(variant)}>
        {title} ({items.length})
      </h2>
      {items.map((item) => (
        <SummaryItem key={item.task.id} item={item} variant={variant} onComplete={onComplete} onItemClick={onItemClick} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DailySummaryPage
// ---------------------------------------------------------------------------

export function DailySummaryPage() {
  const { summary, loading, error, refetch } = useDailySummary();
  const [overlayTaskId, setOverlayTaskId] = useState<string | null>(null);

  if (loading && !summary) {
    return <div style={styles.loading}>Loading today's summary...</div>;
  }

  if (error && !summary) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!summary) return null;

  const isEmpty = summary.counts.total === 0;

  return (
    <div style={styles.page}>
      <div style={styles.dateHeader}>
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>

      {isEmpty ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>All clear</div>
          <div>Nothing due today. Enjoy your free time.</div>
        </div>
      ) : (
        <>
          <SummarySection
            title="Overdue"
            variant="danger"
            items={summary.overdue}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
          <SummarySection
            title="Due Today"
            variant="primary"
            items={summary.due_today}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
          <SummarySection
            title="Upcoming"
            variant="muted"
            items={summary.upcoming}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
        </>
      )}

      {overlayTaskId && (
        <TaskDetailOverlay taskId={overlayTaskId} onClose={() => setOverlayTaskId(null)} />
      )}
    </div>
  );
}
