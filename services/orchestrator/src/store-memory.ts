import { createRequestId } from "@hypershift/shared";
import type { RunRecord, AuditLogRecord, Workspace } from "./types.js";
import { generateApiKey, parseAndVerifyApiKey } from "./api-keys.js";

const DEFAULT_WORKSPACE_ID = "ws-default";

const runs = new Map<string, RunRecord>();
const auditLogs: AuditLogRecord[] = [];
let auditSeq = 0;
const workspaces = new Map<string, Workspace>();
const usageByWorkspace = new Map<
  string,
  { runs: number; deploys: number; period_start: string }
>();
const apiKeysByPrefix = new Map<
  string,
  {
    id: string;
    workspace_id: string;
    key_hash: string;
    name: string;
    created_at: string;
  }
>();
const apiKeyIds = new Set<string>();

function ensureWorkspace(workspaceId: string): void {
  if (!workspaces.has(workspaceId)) {
    workspaces.set(workspaceId, {
      id: workspaceId,
      name: workspaceId === DEFAULT_WORKSPACE_ID ? "Default" : workspaceId,
      tier: "free",
      created_at: new Date().toISOString(),
    });
  }
}

export function createRun(
  user_intent: RunRecord["user_intent"],
  opts: {
    codename?: string;
    tags?: string[];
    workspace_id?: string;
    created_by?: string | null;
    require_approval?: boolean;
  } = {},
): RunRecord {
  const workspace_id = opts.workspace_id ?? DEFAULT_WORKSPACE_ID;
  ensureWorkspace(workspace_id);
  const now = new Date().toISOString();
  const id = createRequestId();
  const run: RunRecord = {
    id,
    status: "pending",
    current_step: 0,
    error: null,
    user_intent,
    architect_output: null,
    builder_output: null,
    sentinel_output: null,
    sre_output: null,
    finops_output: null,
    created_at: now,
    updated_at: now,
    deployment_url: null,
    codename: opts.codename ?? null,
    tags: opts.tags ?? null,
    workspace_id,
    created_by: opts.created_by ?? null,
    require_approval: opts.require_approval ?? false,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    started_at: null,
    completed_at: null,
    failed_step: null,
    duration_ms: null,
    feedback_useful: null,
    feedback_deploy_succeeded: null,
    feedback_at: null,
  };
  runs.set(id, run);
  appendAudit(
    run.id,
    workspace_id,
    "run.created",
    { user_intent, created_by: opts.created_by },
    opts.created_by ?? null,
  );
  incrementUsage(workspace_id, "runs");
  return run;
}

export function getRun(id: string): RunRecord | undefined {
  return runs.get(id);
}

export function listRuns(workspace_id?: string, tag?: string): RunRecord[] {
  let list = Array.from(runs.values());
  if (workspace_id) list = list.filter((r) => r.workspace_id === workspace_id);
  if (tag) list = list.filter((r) => r.tags?.includes(tag));
  list.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return list;
}

export function updateRun(
  id: string,
  patch: Partial<
    Pick<
      RunRecord,
      | "status"
      | "current_step"
      | "error"
      | "architect_output"
      | "builder_output"
      | "sentinel_output"
      | "sre_output"
      | "finops_output"
      | "deployment_url"
      | "approved_at"
      | "approved_by"
      | "rejected_at"
      | "rejected_by"
      | "started_at"
      | "completed_at"
      | "failed_step"
      | "duration_ms"
      | "feedback_useful"
      | "feedback_deploy_succeeded"
      | "feedback_at"
    >
  >,
): RunRecord | undefined {
  const run = runs.get(id);
  if (!run) return undefined;
  Object.assign(run, patch, { updated_at: new Date().toISOString() });
  return run;
}

export function appendAudit(
  run_id: string,
  workspace_id: string,
  action: string,
  details: unknown,
  actor: string | null,
): void {
  auditSeq += 1;
  auditLogs.push({
    id: auditSeq,
    run_id,
    workspace_id,
    created_at: new Date().toISOString(),
    action,
    details,
    actor,
  });
}

export function getAuditLogs(run_id: string): AuditLogRecord[] {
  return auditLogs.filter((e) => e.run_id === run_id);
}

export function getWorkspace(id: string): Workspace | undefined {
  ensureWorkspace(id);
  return workspaces.get(id);
}

export function createWorkspace(name: string, id?: string): Workspace {
  const workspaceId =
    id ??
    `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ws: Workspace = {
    id: workspaceId,
    name: name || workspaceId,
    tier: "free",
    created_at: new Date().toISOString(),
  };
  workspaces.set(workspaceId, ws);
  return ws;
}

export function getUsage(
  workspace_id: string,
  periodStart: string,
): { runs: number; deploys: number } {
  const key = `${workspace_id}:${periodStart}`;
  const u = usageByWorkspace.get(key);
  return u ? { runs: u.runs, deploys: u.deploys } : { runs: 0, deploys: 0 };
}

export function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function incrementUsage(workspace_id: string, kind: "runs" | "deploys"): void {
  const period = currentPeriodStart();
  const key = `${workspace_id}:${period}`;
  const cur = usageByWorkspace.get(key) ?? {
    runs: 0,
    deploys: 0,
    period_start: period,
  };
  if (kind === "runs") cur.runs += 1;
  else cur.deploys += 1;
  usageByWorkspace.set(key, cur);
}

export function recordDeploy(workspace_id: string): void {
  incrementUsage(workspace_id, "deploys");
}

export function getRunOutcomes(workspace_id: string): {
  run_id: string;
  status: string;
  duration_ms: number | null;
  failed_step: string | null;
  completed_at: string | null;
}[] {
  return listRuns(workspace_id)
    .filter(
      (r) =>
        r.status === "completed" ||
        r.status === "failed" ||
        r.status === "blocked",
    )
    .map((r) => ({
      run_id: r.id,
      status: r.status,
      duration_ms: r.duration_ms,
      failed_step: r.failed_step,
      completed_at: r.completed_at,
    }));
}

export const LIMITS = {
  free: { runs_per_month: 10 },
  pro: { runs_per_month: 1000 },
} as const;

export function getRunLimit(workspace_id: string): number {
  const ws = workspaces.get(workspace_id);
  return (ws?.tier === "pro" ? LIMITS.pro : LIMITS.free).runs_per_month;
}

export function checkRunLimit(workspace_id: string): {
  allowed: boolean;
  current: number;
  limit: number;
} {
  ensureWorkspace(workspace_id);
  const period = currentPeriodStart();
  const key = `${workspace_id}:${period}`;
  const cur = usageByWorkspace.get(key) ?? {
    runs: 0,
    deploys: 0,
    period_start: period,
  };
  const limit = getRunLimit(workspace_id);
  return { allowed: cur.runs < limit, current: cur.runs, limit };
}

export function setWorkspaceTier(
  workspace_id: string,
  tier: "free" | "pro",
): void {
  ensureWorkspace(workspace_id);
  const ws = workspaces.get(workspace_id)!;
  ws.tier = tier;
}

export interface ApiKeyRecord {
  id: string;
  workspace_id: string;
  key_prefix: string;
  name: string;
  created_at: string;
}

export function createApiKey(
  workspace_id: string,
  name: string,
): ApiKeyRecord & { key: string } {
  ensureWorkspace(workspace_id);
  const { key, prefix, hash } = generateApiKey();
  const id = `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  apiKeysByPrefix.set(prefix, {
    id,
    workspace_id,
    key_hash: hash,
    name: name || "API key",
    created_at: now,
  });
  apiKeyIds.add(id);
  return {
    id,
    workspace_id,
    key_prefix: prefix,
    name: name || "API key",
    created_at: now,
    key,
  };
}

export function getWorkspaceIdByApiKey(
  prefix: string,
  keyHash: string,
): string | null {
  const row = apiKeysByPrefix.get(prefix);
  if (!row || row.key_hash !== keyHash) return null;
  return row.workspace_id;
}

export function listApiKeys(workspace_id: string): Omit<ApiKeyRecord, "key">[] {
  return Array.from(apiKeysByPrefix.entries())
    .filter(([, v]) => v.workspace_id === workspace_id)
    .map(([key_prefix, v]) => ({
      id: v.id,
      workspace_id: v.workspace_id,
      key_prefix,
      name: v.name,
      created_at: v.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function revokeApiKey(workspace_id: string, keyId: string): boolean {
  for (const [prefix, v] of apiKeysByPrefix.entries()) {
    if (v.id === keyId && v.workspace_id === workspace_id) {
      apiKeysByPrefix.delete(prefix);
      apiKeyIds.delete(keyId);
      return true;
    }
  }
  return false;
}

export function resolveWorkspaceFromApiKey(rawKey: string): string | null {
  const parsed = parseAndVerifyApiKey(rawKey);
  if (!parsed) return null;
  return getWorkspaceIdByApiKey(parsed.prefix, parsed.hash);
}
