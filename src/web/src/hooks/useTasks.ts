import { useCallback, useEffect, useState } from "react";
import type { HomeTaskSummary } from "@domain/entities";
import { fetchTasks } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseTasksResult {
  tasks: HomeTaskSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTasks(params?: {
  status?: string; area?: string; effort?: string; title?: string;
  limit?: number; offset?: number;
}): UseTasksResult {
  const [tasks, setTasks] = useState<HomeTaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize params to a stable key for useEffect
  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = params ?? {};
    fetchTasks(p)
      .then((data) => {
        setTasks(data.data);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
        setLoading(false);
      });
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEntitySubscription(["home_task", "schedule"], load);

  return { tasks, total, loading, error, refetch: load };
}
