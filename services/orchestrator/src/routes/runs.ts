import { Router } from "express";
import { userIntentSchema } from "@hypershift/contracts";
import * as store from "../store.js";
import { addRunJob } from "../queue.js";
import { fireWebhook, getWebhookUrl } from "../webhooks.js";
import { getWorkspaceId, getActor } from "./context.js";

export const runsRouter = Router();

import type { RunRecord } from "../types.js";

function runToDetail(r: RunRecord) {
  return {
    id: r.id,
    status: r.status,
    current_step: r.current_step,
    error: r.error,
    user_intent: r.user_intent,
    architect_output: r.architect_output,
    builder_output: r.builder_output,
    sentinel_output: r.sentinel_output,
    sre_output: r.sre_output,
    finops_output: r.finops_output,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deployment_url: r.deployment_url,
    codename: r.codename,
    tags: r.tags,
    require_approval: r.require_approval,
    approved_at: r.approved_at,
    approved_by: r.approved_by,
    rejected_at: r.rejected_at,
    rejected_by: r.rejected_by,
    feedback_useful: r.feedback_useful,
    feedback_deploy_succeeded: r.feedback_deploy_succeeded,
    feedback_at: r.feedback_at,
  };
}

function runToSummary(r: RunRecord) {
  return {
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    codename: r.codename,
    tags: r.tags,
  };
}

// GET /runs
runsRouter.get("/", (req, res) => {
  const workspace_id = getWorkspaceId(req);
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  const list = store.listRuns(workspace_id, tag);
  res.json({ runs: list.map(runToSummary) });
});

// POST /runs
runsRouter.post("/", (req, res) => {
  const parsed = userIntentSchema.safeParse(req.body?.user_intent ?? req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid user_intent",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const workspace_id = getWorkspaceId(req);
  const limitCheck = store.checkRunLimit(workspace_id);
  if (!limitCheck.allowed) {
    res.status(402).json({
      error: "Run limit exceeded for this period",
      current: limitCheck.current,
      limit: limitCheck.limit,
      period: store.currentPeriodStart(),
    });
    return;
  }
  const actor = getActor(req);
  const run = store.createRun(parsed.data, {
    codename: req.body?.codename,
    tags: Array.isArray(req.body?.tags) ? req.body.tags : undefined,
    workspace_id,
    created_by: actor,
    require_approval: Boolean(req.body?.require_approval),
  });
  const url = getWebhookUrl();
  if (url)
    fireWebhook(url, "run.created", {
      run_id: run.id,
      workspace_id,
      user_intent: run.user_intent,
    });
  res.status(201).json({ run_id: run.id });
});

// GET /runs/:id
runsRouter.get("/:id", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json(runToDetail(run));
});

// POST /runs/:id/start
runsRouter.post("/:id/start", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  if (run.status !== "pending") {
    res.status(400).json({ error: "Run is not pending" });
    return;
  }
  addRunJob(run.id).catch((err) =>
    console.error("[runs] enqueue start failed", err),
  );
  res.status(202).json({ message: "Run started" });
});

// POST /runs/:id/approve
runsRouter.post("/:id/approve", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  if (run.status !== "blocked" || !run.require_approval) {
    res.status(400).json({ error: "Run is not awaiting approval" });
    return;
  }
  const actor = getActor(req) ?? "unknown";
  const now = new Date().toISOString();
  store.updateRun(run.id, {
    approved_at: now,
    approved_by: actor,
    status: "running",
    error: null,
  });
  store.appendAudit(
    run.id,
    run.workspace_id,
    "run.approved",
    { by: actor },
    actor,
  );
  addRunJob(run.id).catch((err) =>
    console.error("[runs] enqueue approve failed", err),
  );
  res.json({ message: "Approved", run_id: run.id });
});

// POST /runs/:id/reject
runsRouter.post("/:id/reject", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  if (run.status !== "blocked" || !run.require_approval) {
    res.status(400).json({ error: "Run is not awaiting approval" });
    return;
  }
  const actor = getActor(req) ?? "unknown";
  const now = new Date().toISOString();
  const completed_at = now;
  const duration_ms = run.started_at
    ? new Date(completed_at).getTime() - new Date(run.started_at).getTime()
    : null;
  store.updateRun(run.id, {
    rejected_at: now,
    rejected_by: actor,
    status: "blocked",
    error: "Production deploy rejected",
    failed_step: "approval",
    completed_at,
    duration_ms,
  });
  store.appendAudit(
    run.id,
    run.workspace_id,
    "run.rejected",
    { by: actor },
    actor,
  );
  res.json({ message: "Rejected", run_id: run.id });
});

// POST /runs/:id/replay
runsRouter.post("/:id/replay", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const workspace_id = getWorkspaceId(req);
  const actor = getActor(req);
  const newRun = store.createRun(run.user_intent, {
    codename: run.codename ?? undefined,
    tags: run.tags ?? undefined,
    workspace_id,
    created_by: actor,
    require_approval: run.require_approval,
  });
  addRunJob(newRun.id).catch((err) =>
    console.error("[runs] enqueue replay failed", err),
  );
  res.status(201).json({ run_id: newRun.id });
});

// POST /runs/:id/rollback
runsRouter.post("/:id/rollback", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const actor = getActor(req);
  store.appendAudit(
    run.id,
    run.workspace_id,
    "rollback.executed",
    { run_id: run.id },
    actor,
  );
  res.json({ message: "Rollback recorded (mock)", audit_recorded: true });
});

// POST /runs/:id/feedback
runsRouter.post("/:id/feedback", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const useful = req.body?.useful;
  const deploy_succeeded = req.body?.deploy_succeeded;
  if (typeof useful !== "boolean" && typeof deploy_succeeded !== "boolean") {
    res.status(400).json({
      error:
        "Provide at least one of useful (boolean) or deploy_succeeded (boolean)",
    });
    return;
  }
  const now = new Date().toISOString();
  store.updateRun(run.id, {
    feedback_useful: typeof useful === "boolean" ? useful : run.feedback_useful,
    feedback_deploy_succeeded:
      typeof deploy_succeeded === "boolean"
        ? deploy_succeeded
        : run.feedback_deploy_succeeded,
    feedback_at: now,
  });
  res.json({ message: "Feedback recorded", run_id: run.id });
});

// GET /runs/:id/logs
runsRouter.get("/:id/logs", (req, res) => {
  const run = store.getRun(req.params.id!);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const logs = store.getAuditLogs(run.id);
  res.json({
    run_id: run.id,
    logs: logs.map((e) => ({
      id: e.id,
      run_id: e.run_id,
      created_at: e.created_at,
      action: e.action,
      details: e.details,
    })),
  });
});
