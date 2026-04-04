import { useCallback, useEffect, useState } from "react";
import type { HomeTask, Note, ScheduleSummary, ActivityLog } from "@domain/entities";
import { fetchTask, fetchNote, fetchNotes, fetchSchedules, fetchActivityLog } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseTaskResult {
  task: HomeTask | null;
  schedules: ScheduleSummary[];
  notes: Note[];
  completionHistory: ActivityLog[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTask(id: string): UseTaskResult {
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
      fetchTask(id),
      fetchSchedules({ task_id: id }),
      fetchNotes({ task_id: id }),
      fetchActivityLog({ entity_type: "home_task", entity_id: id, limit: 50 }),
    ])
      .then(async ([taskData, schedulesData, notesData, activityData]) => {
        setTask(taskData);
        setSchedules(schedulesData.data);
        // Notes come back as summaries from list endpoint — fetch full notes individually
        if (notesData.data.length > 0) {
          try {
            const fullNotes = await Promise.all(
              notesData.data.slice(0, 50).map((n) => fetchNote(n.id))
            );
            setNotes(fullNotes);
          } catch {
            // Fall back to summary data if individual fetches fail
            setNotes(notesData.data as unknown as Note[]);
          }
        } else {
          setNotes([]);
        }
        // Filter for completed actions
        setCompletionHistory(activityData.data.filter((a) => a.action === "completed"));
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load task");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEntitySubscription(["home_task", "schedule", "note"], load);

  return { task, schedules, notes, completionHistory, loading, error, refetch: load };
}
