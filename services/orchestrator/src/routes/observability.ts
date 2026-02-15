import { Router } from "express";
import * as store from "../store.js";
import { getWorkspaceId } from "./context.js";

export const observabilityRouter = Router();

/** GET /observability/outcomes — run outcomes for pipeline health / SLO. */
observabilityRouter.get("/outcomes", (req, res) => {
  const workspace_id = getWorkspaceId(req);
  const outcomes = store.getRunOutcomes(workspace_id);
  res.json({ workspace_id, outcomes });
});

/** GET /observability/slo?days=7|30 — success rate and avg duration. */
observabilityRouter.get("/slo", (req, res) => {
  const workspace_id = getWorkspaceId(req);
  const days = Math.min(30, Math.max(1, Number(req.query?.days) || 7));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const outcomes = store
    .getRunOutcomes(workspace_id)
    .filter((o) => o.completed_at && new Date(o.completed_at) >= cutoff);
  const total = outcomes.length;
  const completed = outcomes.filter((o) => o.status === "completed").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  const blocked = outcomes.filter((o) => o.status === "blocked").length;
  const withDuration = outcomes.filter((o) => o.duration_ms != null) as {
    duration_ms: number;
  }[];
  const avgDurationMs = withDuration.length
    ? withDuration.reduce((s, o) => s + o.duration_ms, 0) / withDuration.length
    : null;
  res.json({
    workspace_id,
    days,
    total_runs: total,
    success_count: completed,
    failure_count: failed,
    blocked_count: blocked,
    success_rate: total ? completed / total : 0,
    avg_duration_ms: avgDurationMs,
  });
});
