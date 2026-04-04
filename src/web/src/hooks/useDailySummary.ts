import { useCallback, useEffect, useState } from "react";
import type { DailySummary } from "@domain/summary";
import { fetchDailySummary } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseDailySummaryResult {
  summary: DailySummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDailySummary(date?: string, lookahead?: number): UseDailySummaryResult {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDailySummary(date, lookahead)
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load summary");
        setLoading(false);
      });
  }, [date, lookahead]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch on any domain event related to tasks, schedules, or notes
  useEntitySubscription(["home_task", "schedule", "note"], load);

  return { summary, loading, error, refetch: load };
}
