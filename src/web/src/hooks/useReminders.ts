import { useCallback, useEffect, useState } from "react";
import type { ReminderSummary } from "@domain/entities";
import { fetchReminders } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseRemindersResult {
  reminders: ReminderSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReminders(params?: {
  context?: string; remind_at_from?: string; remind_at_to?: string;
  status?: string; limit?: number; offset?: number;
}): UseRemindersResult {
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = params ?? {};
    fetchReminders(p)
      .then((data) => {
        setReminders(data.data);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load reminders");
        setLoading(false);
      });
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEntitySubscription(["reminder"], load);

  return { reminders, total, loading, error, refetch: load };
}
