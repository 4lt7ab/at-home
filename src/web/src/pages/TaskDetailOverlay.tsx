import { useState, useEffect, useCallback } from "react";
import {
  semantic as t, Card, Badge, Button, Stack, Skeleton, ModalShell, StatusDot,
} from "@4lt7ab/ui/ui";
import type { HomeTask, Note, ScheduleSummary, ActivityLog } from "@domain/entities";
import { fetchTask, fetchSchedules, fetchNotes, fetchNote, fetchActivityLog } from "../api";
import { formatCompletionSummary } from "../utils";

// ---------------------------------------------------------------------------
// TaskDetailOverlay
// ---------------------------------------------------------------------------

export function TaskDetailOverlay({ taskId, onClose }: { taskId: string; onClose: () => void }): React.JSX.Element {
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
        const noteSlice = notesData.data.slice(0, 5);
        if (noteSlice.length > 0) {
          try {
            const fullNotes = await Promise.all(noteSlice.map((n) => fetchNote(n.id)));
            setNotes(fullNotes);
          } catch {
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
  const manualNotes = notes.filter((n) => n.note_type !== "completion");

  return (
    <ModalShell onClose={onClose}>
      {loading && (
        <Stack gap="md" style={{ padding: `${t.spaceXl} 0` }}>
          <Skeleton height={24} />
          <Skeleton height={80} />
        </Stack>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: `${t.spaceXl} 0`, color: t.colorError }}>
          {error}
        </div>
      )}

      {!loading && !error && task && (
        <>
          {/* Header */}
          <div style={{ fontSize: t.fontSizeLg, fontWeight: 600 }}>{task.title}</div>
          <Stack direction="row" gap="xs" style={{ marginTop: t.spaceSm, flexWrap: "wrap", alignItems: "center" }}>
            <StatusDot status={task.status} color={statusColor(task.status)} size="sm" />
            <Badge variant="secondary">{task.status}</Badge>
            {task.area && <Badge variant="secondary">{task.area.replace(/_/g, " ")}</Badge>}
            {task.effort && <Badge variant="secondary">{task.effort}</Badge>}
          </Stack>

          {/* Description */}
          {task.description && (
            <section style={{ marginTop: t.spaceLg }}>
              <h3 style={{ fontSize: t.fontSizeSm, fontWeight: 600, marginBottom: t.spaceXs, color: t.colorTextSecondary }}>Description</h3>
              <div style={{ fontSize: t.fontSizeSm, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{task.description}</div>
            </section>
          )}

          {/* Schedule */}
          {schedule && (
            <section style={{ marginTop: t.spaceLg }}>
              <h3 style={{ fontSize: t.fontSizeSm, fontWeight: 600, marginBottom: t.spaceXs, color: t.colorTextSecondary }}>Schedule</h3>
              <Card>
                <Stack direction="row" gap="sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Badge variant="secondary">{schedule.recurrence_type}</Badge>
                  {schedule.next_due && <span style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>Next due: {schedule.next_due}</span>}
                </Stack>
                {schedule.last_completed && (
                  <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
                    Last completed: {schedule.last_completed}
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Notes */}
          {manualNotes.length > 0 && (
            <section style={{ marginTop: t.spaceLg }}>
              <h3 style={{ fontSize: t.fontSizeSm, fontWeight: 600, marginBottom: t.spaceXs, color: t.colorTextSecondary }}>
                Notes <Badge variant="secondary">{manualNotes.length}</Badge>
              </h3>
              <Stack gap="xs">
                {manualNotes.map((n) => (
                  <Card key={n.id}>
                    <div style={{ fontWeight: 500, fontSize: t.fontSizeSm }}>{n.title}</div>
                    {n.content && (
                      <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
                        {n.content.length > 200 ? n.content.slice(0, 200) + "..." : n.content}
                      </div>
                    )}
                  </Card>
                ))}
              </Stack>
            </section>
          )}

          {/* Completion History */}
          {completionHistory.length > 0 && (
            <section style={{ marginTop: t.spaceLg }}>
              <h3 style={{ fontSize: t.fontSizeSm, fontWeight: 600, marginBottom: t.spaceXs, color: t.colorTextSecondary }}>
                Completion History <Badge variant="secondary">{completionHistory.length}</Badge>
              </h3>
              <Stack gap="xs">
                {completionHistory.map((entry) => (
                  <Card key={entry.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: t.fontSizeSm }}>
                      <span>{formatCompletionSummary(entry.summary)}</span>
                      <span style={{ color: t.colorTextMuted, fontSize: t.fontSizeXs }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </Stack>
            </section>
          )}
        </>
      )}
    </ModalShell>
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
