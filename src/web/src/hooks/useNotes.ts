import { useCallback, useEffect, useState } from "react";
import type { NoteSummary } from "@domain/entities";
import { fetchNotes } from "../api";
import { useEntitySubscription } from "./useEventSubscription";

interface UseNotesResult {
  notes: NoteSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNotes(params?: {
  task_id?: string; title?: string; limit?: number; offset?: number;
}): UseNotesResult {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = params ?? {};
    fetchNotes(p)
      .then((data) => {
        setNotes(data.data);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load notes");
        setLoading(false);
      });
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEntitySubscription(["note"], load);

  return { notes, total, loading, error, refetch: load };
}
