import { useCallback, useEffect, useState } from "react";
import type { LogSummary } from "@domain/entities";
import { fetchLogs } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseLogsResult {
  logs: LogSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLogs(params?: {
  name?: string; limit?: number; offset?: number;
}): UseLogsResult {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = params ?? {};
    fetchLogs(p)
      .then((data) => {
        setLogs(data.data);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load logs");
        setLoading(false);
      });
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // Entry changes move last_logged_at/entry_count, so subscribe to both types.
  useEntitySubscription(["log", "log_entry"], load);

  return { logs, total, loading, error, refetch: load };
}
