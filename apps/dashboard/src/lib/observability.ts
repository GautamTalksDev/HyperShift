/**
 * Simple metrics/logging hook for run outcomes. Send to a future monitoring backend
 * by setting NEXT_PUBLIC_OBSERVABILITY_ENDPOINT or handling in reportRunOutcome.
 */

export interface RunOutcomePayload {
  run_id: string;
  status: "completed" | "failed" | "blocked";
  duration_ms: number;
}

export function reportRunOutcome(payload: RunOutcomePayload): void {
  try {
    if (typeof window === "undefined") return;
    // Log for now; can be extended to POST to NEXT_PUBLIC_OBSERVABILITY_ENDPOINT
    if (process.env.NEXT_PUBLIC_OBSERVABILITY_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_OBSERVABILITY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "run_outcome",
          ...payload,
          ts: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    // Always log to console in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.debug("[observability] run_outcome", payload);
    }
  } catch {
    // ignore
  }
}
