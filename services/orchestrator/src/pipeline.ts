import * as store from "./store.js";
import * as agents from "./agents.js";
import { fireWebhook, getWebhookUrl } from "./webhooks.js";
import { env } from "./env.js";

function emit(event: string, payload: unknown): void {
  const url = getWebhookUrl();
  if (url) fireWebhook(url, event, payload);
}

function delayMs(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

/** Resume from step 4 (SRE) after approval. */
async function runFromStep4(
  runId: string,
  run: NonNullable<ReturnType<typeof store.getRun>>,
): Promise<void> {
  const workspace_id = run.workspace_id;
  const architect_output = run.architect_output;
  const stepDelay = env.PIPELINE_STEP_DELAY_MS;
  await delayMs(stepDelay);
  store.updateRun(runId, { current_step: 4 });
  const sre_output = await agents.callSre(null, runId);
  store.updateRun(runId, { sre_output });
  store.appendAudit(
    runId,
    workspace_id,
    "step.completed",
    { step: "sre", output: sre_output },
    null,
  );
  await delayMs(stepDelay);
  store.updateRun(runId, { current_step: 5 });
  const finops_output = await agents.callFinOps(architect_output);
  store.updateRun(runId, { finops_output });
  store.appendAudit(
    runId,
    workspace_id,
    "step.completed",
    { step: "finops", output: finops_output },
    null,
  );
  let deployment_url: string | null = null;
  if (env.VERCEL_TOKEN && env.DEPLOY_BUILD_BASE_DIR) {
    try {
      deployment_url = "https://example.vercel.app";
      store.recordDeploy(workspace_id);
    } catch {
      // ignore
    }
  }
  const completed_at = new Date().toISOString();
  const duration_ms = run.started_at
    ? new Date(completed_at).getTime() - new Date(run.started_at).getTime()
    : null;
  store.updateRun(runId, {
    status: "completed",
    current_step: 6,
    deployment_url,
    completed_at,
    duration_ms,
  });
  store.appendAudit(
    runId,
    workspace_id,
    "run.completed",
    { deployment_url, duration_ms },
    null,
  );
  store.appendAudit(
    runId,
    workspace_id,
    "deploy.succeeded",
    { deployment_url },
    null,
  );
  emit("run.completed", {
    run_id: runId,
    workspace_id,
    status: "completed",
    deployment_url,
    duration_ms,
  });
  if (deployment_url)
    emit("deploy.succeeded", { run_id: runId, deployment_url });
}

export async function executePipeline(runId: string): Promise<void> {
  const run = store.getRun(runId);
  if (!run) return;
  const workspace_id = run.workspace_id;
  const actor = run.created_by ?? "system";

  const isResume =
    run.status === "running" &&
    run.approved_at != null &&
    run.current_step === 3;
  if (isResume) {
    try {
      await runFromStep4(runId, run);
    } catch (err) {
      const completed_at = new Date().toISOString();
      const duration_ms = run.started_at
        ? new Date(completed_at).getTime() - new Date(run.started_at).getTime()
        : null;
      store.updateRun(runId, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        failed_step: "sre",
        completed_at,
        duration_ms,
      });
      store.appendAudit(
        runId,
        workspace_id,
        "run.failed",
        { error: String(err), failed_step: "sre" },
        null,
      );
      emit("run.completed", {
        run_id: runId,
        workspace_id,
        status: "failed",
        error: String(err),
        failed_step: "sre",
      });
    }
    return;
  }

  if (run.status !== "pending") return;

  store.updateRun(runId, {
    status: "running",
    current_step: 1,
    started_at: new Date().toISOString(),
  });
  store.appendAudit(
    runId,
    workspace_id,
    "run.started",
    { run_id: runId },
    actor,
  );
  emit("run.started", { run_id: runId, workspace_id });

  const stepDelay = env.PIPELINE_STEP_DELAY_MS;

  try {
    // Step 1: Architect
    const rawArchitect = await agents.callArchitect(run.user_intent);
    const architect_output =
      (rawArchitect as { blueprint_manifest?: unknown })?.blueprint_manifest ??
      rawArchitect;
    store.updateRun(runId, { architect_output });
    store.appendAudit(
      runId,
      workspace_id,
      "step.completed",
      { step: "architect", output: architect_output },
      null,
    );
    await delayMs(stepDelay);

    // Step 2: Builder
    store.updateRun(runId, { current_step: 2 });
    const builder_output = await agents.callBuilder(
      run.user_intent,
      architect_output,
    );
    store.updateRun(runId, { builder_output });
    store.appendAudit(
      runId,
      workspace_id,
      "step.completed",
      { step: "builder", output: builder_output },
      null,
    );
    await delayMs(stepDelay);

    // Step 3: Sentinel
    store.updateRun(runId, { current_step: 3 });
    const sentinel_output = await agents.callSentinel(
      architect_output,
      builder_output,
    );
    store.updateRun(runId, { sentinel_output });
    store.appendAudit(
      runId,
      workspace_id,
      "step.completed",
      { step: "sentinel", output: sentinel_output },
      null,
    );
    await delayMs(stepDelay);

    const veto = (sentinel_output as { veto?: boolean })?.veto === true;
    if (veto) {
      const completed_at = new Date().toISOString();
      store.updateRun(runId, {
        status: "blocked",
        error: "Sentinel blocked deploy (security findings)",
        failed_step: "sentinel",
        completed_at,
        duration_ms: run.started_at
          ? new Date(completed_at).getTime() -
            new Date(run.started_at).getTime()
          : null,
      });
      store.appendAudit(
        runId,
        workspace_id,
        "run.blocked",
        { reason: "sentinel_veto" },
        null,
      );
      return;
    }

    // Optional approval gate (stop here so user can approve in the UI)
    if (run.require_approval) {
      const r = store.getRun(runId);
      if (!r?.approved_at && !r?.rejected_at) {
        store.updateRun(runId, {
          status: "blocked",
          error: "Awaiting approval for production deploy",
        });
        store.appendAudit(
          runId,
          workspace_id,
          "run.awaiting_approval",
          {},
          null,
        );
        return; // Pipeline pauses until POST /runs/:id/approve or /reject
      }
      if (r.rejected_at) {
        const completed_at = new Date().toISOString();
        store.updateRun(runId, {
          status: "blocked",
          error: "Production deploy rejected",
          failed_step: "approval",
          completed_at,
          duration_ms: r.started_at
            ? new Date(completed_at).getTime() -
              new Date(r.started_at).getTime()
            : null,
        });
        store.appendAudit(
          runId,
          workspace_id,
          "run.rejected",
          { by: r.rejected_by },
          r.rejected_by,
        );
        return;
      }
    }

    // Step 4: SRE
    await delayMs(stepDelay);
    store.updateRun(runId, { current_step: 4 });
    const sre_output = await agents.callSre(null, runId);
    store.updateRun(runId, { sre_output });
    store.appendAudit(
      runId,
      workspace_id,
      "step.completed",
      { step: "sre", output: sre_output },
      null,
    );
    await delayMs(stepDelay);

    // Step 5: FinOps
    store.updateRun(runId, { current_step: 5 });
    const finops_output = await agents.callFinOps(architect_output);
    store.updateRun(runId, { finops_output });
    store.appendAudit(
      runId,
      workspace_id,
      "step.completed",
      { step: "finops", output: finops_output },
      null,
    );

    // Deploy (mock or real)
    let deployment_url: string | null = null;
    if (env.VERCEL_TOKEN && env.DEPLOY_BUILD_BASE_DIR) {
      try {
        // In a full impl you would run vercel deploy from DEPLOY_BUILD_BASE_DIR
        deployment_url = "https://example.vercel.app";
        store.recordDeploy(workspace_id);
      } catch {
        // leave deployment_url null
      }
    }

    const completed_at = new Date().toISOString();
    const duration_ms = run.started_at
      ? new Date(completed_at).getTime() - new Date(run.started_at).getTime()
      : null;
    store.updateRun(runId, {
      status: "completed",
      current_step: 6,
      deployment_url,
      completed_at,
      duration_ms,
    });
    store.appendAudit(
      runId,
      workspace_id,
      "run.completed",
      { deployment_url, duration_ms },
      null,
    );
    store.appendAudit(
      runId,
      workspace_id,
      "deploy.succeeded",
      { deployment_url },
      null,
    );
    emit("run.completed", {
      run_id: runId,
      workspace_id,
      status: "completed",
      deployment_url,
      duration_ms,
    });
    if (deployment_url)
      emit("deploy.succeeded", { run_id: runId, deployment_url });
  } catch (err) {
    const run2 = store.getRun(runId);
    const step = run2?.current_step ?? 1;
    const stepNames = ["", "architect", "builder", "sentinel", "sre", "finops"];
    const failed_step = stepNames[step] ?? "unknown";
    const completed_at = new Date().toISOString();
    const duration_ms = run.started_at
      ? new Date(completed_at).getTime() - new Date(run.started_at).getTime()
      : null;
    store.updateRun(runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      failed_step,
      completed_at,
      duration_ms,
    });
    store.appendAudit(
      runId,
      workspace_id,
      "run.failed",
      { error: String(err), failed_step },
      null,
    );
    emit("run.completed", {
      run_id: runId,
      workspace_id,
      status: "failed",
      error: String(err),
      failed_step,
    });
  }
}
