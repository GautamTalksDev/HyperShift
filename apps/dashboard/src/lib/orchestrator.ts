import { env } from "@/env";

const BASE = env.NEXT_PUBLIC_ORCHESTRATOR_URL;

/** Message thrown when the orchestrator server is unreachable (e.g. not running). */
export const ORCHESTRATOR_UNREACHABLE_MSG =
  "Orchestrator is not running. Run `pnpm dev` from the repo root (not only apps/dashboard).";

function isNetworkError(err: unknown): boolean {
  if (
    err instanceof TypeError &&
    (err.message === "Failed to fetch" || err.message?.includes("fetch"))
  )
    return true;
  if (err instanceof Error && "cause" in err) {
    const c = (err.cause as NodeJS.ErrnoException)?.code;
    if (
      c === "ECONNREFUSED" ||
      c === "ENOTFOUND" ||
      c === "ETIMEDOUT" ||
      c === "ERR_NETWORK"
    )
      return true;
  }
  return false;
}

/** Optional auth context: send X-Workspace-Id and X-User-Id to scope runs and audit. */
export type OrchestratorAuth = { workspaceId?: string; userId?: string };

function authHeaders(auth?: OrchestratorAuth): Record<string, string> {
  const h: Record<string, string> = {};
  if (auth?.workspaceId) h["X-Workspace-Id"] = auth.workspaceId;
  if (auth?.userId) h["X-User-Id"] = auth.userId;
  return h;
}

async function fetchOrchestrator(
  input: RequestInfo | URL,
  init?: RequestInit,
  auth?: OrchestratorAuth,
): Promise<Response> {
  const headers = {
    ...authHeaders(auth),
    ...(init?.headers as Record<string, string>),
  };
  try {
    return await fetch(input, { ...init, headers });
  } catch (err) {
    if (isNetworkError(err))
      throw new Error(ORCHESTRATOR_UNREACHABLE_MSG, { cause: err });
    throw err;
  }
}

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export interface RunSummary {
  id: string;
  status: RunStatus;
  created_at: string;
  codename?: string | null;
  tags?: string[] | null;
}

export interface RunDetail {
  id: string;
  status: RunStatus;
  current_step: number;
  error: string | null;
  user_intent: { description?: string; target?: string; constraints?: string };
  architect_output: unknown;
  builder_output: unknown;
  sentinel_output: unknown;
  sre_output: unknown;
  finops_output: unknown;
  created_at: string;
  updated_at: string;
  deployment_url?: string | null;
  codename?: string | null;
  tags?: string[] | null;
  require_approval?: boolean;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  feedback_useful?: boolean | null;
  feedback_deploy_succeeded?: boolean | null;
  feedback_at?: string | null;
}

export interface AuditLogEntry {
  id: number;
  run_id: string;
  created_at: string;
  action: string;
  details: unknown;
}

export async function listRuns(
  opts?: { tag?: string },
  auth?: OrchestratorAuth,
): Promise<RunSummary[]> {
  const url = opts?.tag
    ? `${BASE}/runs?tag=${encodeURIComponent(opts.tag)}`
    : `${BASE}/runs`;
  const res = await fetchOrchestrator(url, undefined, auth);
  if (!res.ok) throw new Error("Failed to list runs");
  const data = (await res.json()) as { runs: RunSummary[] };
  return data.runs;
}

export async function getRun(
  id: string,
  auth?: OrchestratorAuth,
): Promise<RunDetail | null> {
  const res = await fetchOrchestrator(`${BASE}/runs/${id}`, undefined, auth);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch run");
  return res.json() as Promise<RunDetail>;
}

export async function getRunLogs(
  id: string,
  auth?: OrchestratorAuth,
): Promise<AuditLogEntry[]> {
  const res = await fetchOrchestrator(
    `${BASE}/runs/${id}/logs`,
    undefined,
    auth,
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Failed to fetch logs");
  const data = (await res.json()) as { run_id: string; logs: AuditLogEntry[] };
  return data.logs;
}

/** Create a run in "pending" state. Pipeline does not run until startRunById(id) is called (e.g. when user enters run page). */
export async function createRun(
  user_intent: { description: string; target?: string; constraints?: string },
  opts?: { codename?: string; tags?: string[]; require_approval?: boolean },
  auth?: OrchestratorAuth,
): Promise<{ run_id: string }> {
  const res = await fetchOrchestrator(
    `${BASE}/runs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_intent,
        codename: opts?.codename,
        tags: opts?.tags,
        require_approval: opts?.require_approval ?? false,
      }),
    },
    auth,
  );
  const data = (await res.json()) as {
    run_id?: string;
    error?: string;
    current?: number;
    limit?: number;
    period?: string;
  };
  if (!res.ok) {
    if (res.status === 402)
      throw new Error(
        data.error ??
          `Run limit exceeded (${data.current ?? 0}/${data.limit ?? 0} this period)`,
      );
    throw new Error(data.error ?? "Failed to create run");
  }
  return { run_id: data.run_id! };
}

/** Start the pipeline for a pending run (call when user enters run page). Returns immediately; pipeline runs in background. */
export async function startRunById(
  runId: string,
  auth?: OrchestratorAuth,
): Promise<void> {
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/start`,
    { method: "POST" },
    auth,
  );
  if (!res.ok && res.status !== 202) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to start run");
  }
}

/** @deprecated Use createRun + redirect to run page, then startRunById on mount for "work starts on run screen". */
export async function startRun(
  user_intent: { description: string; target?: string; constraints?: string },
  opts?: { codename?: string; tags?: string[] },
): Promise<{ run_id: string }> {
  const res = await fetchOrchestrator(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_intent,
      codename: opts?.codename,
      tags: opts?.tags,
    }),
  });
  const data = (await res.json()) as {
    run_id?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    const runId = data.run_id ?? null;
    throw new Error(data.message ?? data.error ?? "Failed to start run", {
      cause: { runId },
    });
  }
  return { run_id: data.run_id! };
}

export async function replayRun(
  runId: string,
  auth?: OrchestratorAuth,
): Promise<{ run_id: string }> {
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/replay`,
    { method: "POST" },
    auth,
  );
  const data = (await res.json()) as {
    run_id?: string;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    const newRunId = data.run_id ?? null;
    throw new Error(data.message ?? data.error ?? "Failed to replay run", {
      cause: { runId: newRunId },
    });
  }
  return { run_id: data.run_id! };
}

export async function executeRollback(
  runId: string,
  auth?: OrchestratorAuth,
): Promise<{ message: string; audit_recorded: boolean }> {
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/rollback`,
    { method: "POST" },
    auth,
  );
  if (!res.ok) throw new Error("Failed to execute rollback");
  return res.json() as Promise<{ message: string; audit_recorded: boolean }>;
}

export async function approveRun(
  runId: string,
  headers?: Record<string, string> | OrchestratorAuth,
): Promise<{ message: string; run_id: string }> {
  const auth = headers && "workspaceId" in headers ? headers : undefined;
  const h =
    headers && !("workspaceId" in headers) ? headers : authHeaders(auth);
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/approve`,
    { method: "POST", headers: { "Content-Type": "application/json", ...h } },
    auth,
  );
  if (!res.ok) throw new Error("Failed to approve run");
  return res.json() as Promise<{ message: string; run_id: string }>;
}

export async function rejectRun(
  runId: string,
  headers?: Record<string, string> | OrchestratorAuth,
): Promise<{ message: string; run_id: string }> {
  const auth = headers && "workspaceId" in headers ? headers : undefined;
  const h =
    headers && !("workspaceId" in headers) ? headers : authHeaders(auth);
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/reject`,
    { method: "POST", headers: { "Content-Type": "application/json", ...h } },
    auth,
  );
  if (!res.ok) throw new Error("Failed to reject run");
  return res.json() as Promise<{ message: string; run_id: string }>;
}

export interface UsageInfo {
  workspace_id: string;
  period: string;
  runs: number;
  limit: number;
  tier: string;
}

export async function getUsage(auth?: OrchestratorAuth): Promise<UsageInfo> {
  const res = await fetchOrchestrator(`${BASE}/usage`, undefined, auth);
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json() as Promise<UsageInfo>;
}

export interface SloInfo {
  workspace_id: string;
  days: number;
  total_runs: number;
  success_count: number;
  failure_count: number;
  blocked_count: number;
  success_rate: number;
  avg_duration_ms: number | null;
}

export async function getSlo(
  days?: number,
  auth?: OrchestratorAuth,
): Promise<SloInfo> {
  const url = days
    ? `${BASE}/observability/slo?days=${days}`
    : `${BASE}/observability/slo`;
  const res = await fetchOrchestrator(url, undefined, auth);
  if (!res.ok) throw new Error("Failed to fetch SLO");
  return res.json() as Promise<SloInfo>;
}

export async function submitRunFeedback(
  runId: string,
  feedback: { useful?: boolean; deploy_succeeded?: boolean },
  auth?: OrchestratorAuth,
): Promise<{ message: string; run_id: string }> {
  const res = await fetchOrchestrator(
    `${BASE}/runs/${encodeURIComponent(runId)}/feedback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    },
    auth,
  );
  if (!res.ok) throw new Error("Failed to submit feedback");
  return res.json() as Promise<{ message: string; run_id: string }>;
}

export interface WhatIfResult {
  estimatedMonthlyCost: number;
  currency: string;
  riskLevel: string;
  message: string;
}

export async function whatIf(
  user_intent: { description: string; target?: string; constraints?: string },
  addition?: string,
  auth?: OrchestratorAuth,
): Promise<WhatIfResult> {
  const res = await fetchOrchestrator(
    `${BASE}/what-if`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_intent, addition: addition ?? "" }),
    },
    auth,
  );
  if (!res.ok) throw new Error("What-if estimate failed");
  return res.json() as Promise<WhatIfResult>;
}

export interface FleetHealth {
  orchestrator: "ok";
  agents: Record<string, "ok" | "down">;
}

export async function getFleetHealth(): Promise<FleetHealth> {
  const res = await fetchOrchestrator(`${BASE}/fleet-health`);
  if (!res.ok) throw new Error("Failed to fetch fleet health");
  return res.json() as Promise<FleetHealth>;
}
