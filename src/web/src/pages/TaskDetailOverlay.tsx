/**
 * TaskDetailOverlay -- read-only overlay showing full task details.
 * Extracted from DailySummaryPage during component system migration.
 */
import { useState, useEffect, useCallback } from "react";
import type { HomeTask, Note, ScheduleSummary, ActivityLog } from "@domain/entities";
import { fetchTask, fetchSchedules, fetchNotes, fetchNote, fetchActivityLog } from "../api";
import { useTheme } from "../components/theme";
import { StatusDot, Badge, Button } from "../components";
import { ContentCard } from "../components/ContentCard";
import { SectionHeading } from "../components/SectionHeading";
import { MarkdownContent, stripMarkdown } from "../components/MarkdownContent";
import { ModalShell } from "../components/organisms/ModalShell";
import { formatCompletionSummary } from "../utils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDetailOverlay({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { theme } = useTheme();
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

  const schedule = schedules[0] ?? null;

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: theme.color.textMuted }}>
          Loading task details...
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "32px 0", color: theme.color.danger }}>
          {error}
        </div>
      )}

      {!loading && !error && task && (
        <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: theme.font.size.lg, fontWeight: 600 }}>{task.title}</div>
            <Button variant="icon" onClick={onClose} aria-label="Close">&times;</Button>
          </div>

          {/* Badges */}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <StatusDot status={task.status} />
            <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{task.status}</span>
            {task.area && (
              <Badge variant="area">{task.area.replace(/_/g, " ")}</Badge>
            )}
            {task.effort && (
              <Badge variant="effort">{task.effort}</Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <>
              <SectionHeading variant="overlay">Description</SectionHeading>
              <div style={{ fontSize: theme.font.size.sm, lineHeight: 1.5, whiteSpace: "pre-wrap", color: theme.color.text }}>
                {task.description}
              </div>
            </>
          )}

          {/* Schedule */}
          {schedule && (
            <>
              <SectionHeading variant="overlay">Schedule</SectionHeading>
              <ContentCard variant="schedule">
                <div>
                  <Badge variant="area">{schedule.recurrence_type}</Badge>
                  {schedule.next_due && (
                    <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Next due: {schedule.next_due}</span>
                  )}
                </div>
                {schedule.last_completed && (
                  <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
                    Last completed: {schedule.last_completed}
                  </div>
                )}
              </ContentCard>
            </>
          )}

          {/* Notes (manual only) */}
          {(() => {
            const manualNotes = notes.filter((n) => n.note_type !== "completion");
            return manualNotes.length > 0 ? (
              <>
                <SectionHeading variant="overlay" count={manualNotes.length}>Notes</SectionHeading>
                {manualNotes.map((n) => (
                  <ContentCard key={n.id} variant="note">
                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                    {n.content && (
                      n.content.length > 200
                        ? <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
                            {stripMarkdown(n.content).slice(0, 200) + "..."}
                          </div>
                        : <MarkdownContent content={n.content} style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }} />
                    )}
                  </ContentCard>
                ))}
              </>
            ) : null;
          })()}

          {/* Completion History (with companion notes) */}
          {completionHistory.length > 0 && (() => {
            const noteMap = new Map<string, Note>();
            for (const n of notes) noteMap.set(n.id, n);
            return (
              <>
                <SectionHeading variant="overlay" count={completionHistory.length}>Completion History</SectionHeading>
                {completionHistory.map((entry) => {
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
                        <span style={{ marginLeft: 8, color: theme.color.textFaint }}>
                          {new Date(entry.created_at).toLocaleDateString()}
                        </span>
                      </ContentCard>
                      {companionNote && (
                        <ContentCard variant="completion-note" style={{ marginLeft: 12, marginTop: 2 }}>
                          <div style={{ fontWeight: 500, fontSize: theme.font.size.xs }}>{companionNote.title}</div>
                          {companionNote.content && (
                            companionNote.content.length > 120
                              ? <div style={{ fontSize: 11, color: theme.color.textMuted, marginTop: 2 }}>
                                  {stripMarkdown(companionNote.content).slice(0, 120) + "..."}
                                </div>
                              : <MarkdownContent content={companionNote.content} style={{ fontSize: 11, color: theme.color.textMuted, marginTop: 2 }} />
                          )}
                        </ContentCard>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </>
      )}
    </ModalShell>
  );
}
