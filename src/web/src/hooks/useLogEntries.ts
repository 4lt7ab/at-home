import { useCallback, useEffect, useState } from "react";
import type { LogEntrySummary } from "@domain/entities";
import { fetchLogEntries } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseLogEntriesResult {
  entries: LogEntrySummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLogEntries(
  logId: string | null,
  params?: {
    occurred_at_from?: string;
    occurred_at_to?: string;
    limit?: number;
    offset?: number;
  },
): UseLogEntriesResult {
  const [entries, setEntries] = useState<LogEntrySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(!!logId);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(() => {
    if (!logId) {
      setEntries([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchLogEntries(logId, params ?? {})
      .then((data) => {
        setEntries(data.data);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load log entries");
        setLoading(false);
      });
  }, [logId, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEntitySubscription(["log_entry"], load);

  return { entries, total, loading, error, refetch: load };
}
