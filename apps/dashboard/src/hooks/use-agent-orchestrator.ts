import { useCallback, useEffect, useState } from "react";
import { listRuns, createRun, type RunSummary } from "@/lib/orchestrator";

type UserIntent = {
  description: string;
  target?: string;
  constraints?: string;
};

interface UseAgentOrchestratorOptions {
  /**
   * How often to refresh the runs list, in milliseconds.
   * Defaults to 2000ms to match the existing dashboard behavior.
   */
  pollIntervalMs?: number;
}

export function useAgentOrchestrator(
  options: UseAgentOrchestratorOptions = {},
) {
  const { pollIntervalMs = 2000 } = options;

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRuns() {
      try {
        const data = await listRuns();
        if (!cancelled) {
          setRuns(data);
        }
      } catch {
        if (!cancelled) {
          // Match previous behavior: on error, show an empty list without surfacing the error.
          setRuns([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRuns();
    const interval = setInterval(fetchRuns, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  const runWithIntent = useCallback(async (user_intent: UserIntent) => {
    setError(null);
    setSubmitting(true);
    try {
      const { run_id } = await createRun(user_intent);
      window.location.href = `/runs/${run_id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    runs,
    loading,
    submitting,
    error,
    setError,
    runWithIntent,
  };
}
