/**
 * SQLite-backed persistent store for runs, workspaces, usage, and audit log.
 * Same API as the in-memory store.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { createRequestId } from "@hypershift/shared";
import type { RunRecord, AuditLogRecord, Workspace } from "./types.js";
import { generateApiKey, parseAndVerifyApiKey } from "./api-keys.js";

const DEFAULT_WORKSPACE_ID = "ws-default";

let db: Database.Database;

export function initSqliteStore(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      current_step INTEGER NOT NULL,
      error TEXT,
      user_intent TEXT NOT NULL,
      architect_output TEXT,
      builder_output TEXT,
      sentinel_output TEXT,
      sre_output TEXT,
      finops_output TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deployment_url TEXT,
      codename TEXT,
      tags TEXT,
      workspace_id TEXT NOT NULL,
      created_by TEXT,
      require_approval INTEGER NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      rejected_at TEXT,
      rejected_by TEXT,
      started_at TEXT,
      completed_at TEXT,
      failed_step TEXT,
      duration_ms INTEGER,
      feedback_useful INTEGER,
      feedback_deploy_succeeded INTEGER,
      feedback_at TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      actor TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    CREATE TABLE IF NOT EXISTS usage (
      workspace_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      runs INTEGER NOT NULL DEFAULT 0,
      deploys INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (workspace_id, period_start),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_audit_run ON audit_logs(run_id);
  `);
  // Ensure default workspace exists
  const existing = db
    .prepare("SELECT 1 FROM workspaces WHERE id = ?")
    .get(DEFAULT_WORKSPACE_ID);
  if (!existing) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO workspaces (id, name, tier, created_at) VALUES (?, ?, ?, ?)",
    ).run(DEFAULT_WORKSPACE_ID, "Default", "free", now);
  }
}

function getDb(): Database.Database {
  if (!db)
    throw new Error(
      "SQLite store not initialized; set ORCHESTRATOR_DATABASE_PATH and call initSqliteStore()",
    );
  return db;
}

function ensureWorkspace(workspaceId: string): void {
  const database = getDb();
  const existing = database
    .prepare("SELECT 1 FROM workspaces WHERE id = ?")
    .get(workspaceId);
  if (!existing) {
    const now = new Date().toISOString();
    database
      .prepare(
        "INSERT INTO workspaces (id, name, tier, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(
        workspaceId,
        workspaceId === DEFAULT_WORKSPACE_ID ? "Default" : workspaceId,
        "free",
        now,
      );
  }
}

function runFromRow(row: Record<string, unknown>): RunRecord {
  return {
    id: row.id as string,
    status: row.status as RunRecord["status"],
    current_step: Number(row.current_step),
    error: (row.error as string) ?? null,
    user_intent: JSON.parse(
      row.user_intent as string,
    ) as RunRecord["user_intent"],
    architect_output:
      row.architect_output != null
        ? JSON.parse(row.architect_output as string)
        : null,
    builder_output:
      row.builder_output != null
        ? JSON.parse(row.builder_output as string)
        : null,
    sentinel_output:
      row.sentinel_output != null
        ? JSON.parse(row.sentinel_output as string)
        : null,
    sre_output:
      row.sre_output != null ? JSON.parse(row.sre_output as string) : null,
    finops_output:
      row.finops_output != null
        ? JSON.parse(row.finops_output as string)
        : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deployment_url: (row.deployment_url as string) ?? null,
    codename: (row.codename as string) ?? null,
    tags: row.tags != null ? JSON.parse(row.tags as string) : null,
    workspace_id: row.workspace_id as string,
    created_by: (row.created_by as string) ?? null,
    require_approval: Boolean(row.require_approval),
    approved_at: (row.approved_at as string) ?? null,
    approved_by: (row.approved_by as string) ?? null,
    rejected_at: (row.rejected_at as string) ?? null,
    rejected_by: (row.rejected_by as string) ?? null,
    started_at: (row.started_at as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    failed_step: (row.failed_step as string) ?? null,
    duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
    feedback_useful:
      row.feedback_useful != null ? Boolean(row.feedback_useful) : null,
    feedback_deploy_succeeded:
      row.feedback_deploy_succeeded != null
        ? Boolean(row.feedback_deploy_succeeded)
        : null,
    feedback_at: (row.feedback_at as string) ?? null,
  };
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
  const database = getDb();
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
  database
    .prepare(
      `INSERT INTO runs (id, status, current_step, error, user_intent, architect_output, builder_output, sentinel_output, sre_output, finops_output, created_at, updated_at, deployment_url, codename, tags, workspace_id, created_by, require_approval, approved_at, approved_by, rejected_at, rejected_by, started_at, completed_at, failed_step, duration_ms, feedback_useful, feedback_deploy_succeeded, feedback_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.id,
      run.status,
      run.current_step,
      run.error,
      JSON.stringify(run.user_intent),
      null,
      null,
      null,
      null,
      null,
      run.created_at,
      run.updated_at,
      run.deployment_url,
      run.codename,
      run.tags ? JSON.stringify(run.tags) : null,
      run.workspace_id,
      run.created_by,
      run.require_approval ? 1 : 0,
      run.approved_at,
      run.approved_by,
      run.rejected_at,
      run.rejected_by,
      run.started_at,
      run.completed_at,
      run.failed_step,
      run.duration_ms,
      run.feedback_useful != null ? (run.feedback_useful ? 1 : 0) : null,
      run.feedback_deploy_succeeded != null
        ? run.feedback_deploy_succeeded
          ? 1
          : 0
        : null,
      run.feedback_at,
    );
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
  const database = getDb();
  const row = database.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? runFromRow(row) : undefined;
}

export function listRuns(workspace_id?: string, tag?: string): RunRecord[] {
  const database = getDb();
  let rows: Record<string, unknown>[];
  if (workspace_id && tag) {
    rows = database
      .prepare(
        "SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC",
      )
      .all(workspace_id) as Record<string, unknown>[];
    rows = rows.filter((r) =>
      (JSON.parse((r.tags as string) ?? "[]") as string[]).includes(tag),
    );
  } else if (workspace_id) {
    rows = database
      .prepare(
        "SELECT * FROM runs WHERE workspace_id = ? ORDER BY created_at DESC",
      )
      .all(workspace_id) as Record<string, unknown>[];
  } else {
    rows = database
      .prepare("SELECT * FROM runs ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];
    if (tag)
      rows = rows.filter((r) =>
        (JSON.parse((r.tags as string) ?? "[]") as string[]).includes(tag),
      );
  }
  return rows.map(runFromRow);
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
  const run = getRun(id);
  if (!run) return undefined;
  const updated = { ...run, ...patch, updated_at: new Date().toISOString() };
  const database = getDb();
  database
    .prepare(
      `UPDATE runs SET status=?, current_step=?, error=?, architect_output=?, builder_output=?, sentinel_output=?, sre_output=?, finops_output=?, updated_at=?, deployment_url=?, approved_at=?, approved_by=?, rejected_at=?, rejected_by=?, started_at=?, completed_at=?, failed_step=?, duration_ms=?, feedback_useful=?, feedback_deploy_succeeded=?, feedback_at=? WHERE id=?`,
    )
    .run(
      updated.status,
      updated.current_step,
      updated.error,
      updated.architect_output != null
        ? JSON.stringify(updated.architect_output)
        : null,
      updated.builder_output != null
        ? JSON.stringify(updated.builder_output)
        : null,
      updated.sentinel_output != null
        ? JSON.stringify(updated.sentinel_output)
        : null,
      updated.sre_output != null ? JSON.stringify(updated.sre_output) : null,
      updated.finops_output != null
        ? JSON.stringify(updated.finops_output)
        : null,
      updated.updated_at,
      updated.deployment_url,
      updated.approved_at,
      updated.approved_by,
      updated.rejected_at,
      updated.rejected_by,
      updated.started_at,
      updated.completed_at,
      updated.failed_step,
      updated.duration_ms,
      updated.feedback_useful != null
        ? updated.feedback_useful
          ? 1
          : 0
        : null,
      updated.feedback_deploy_succeeded != null
        ? updated.feedback_deploy_succeeded
          ? 1
          : 0
        : null,
      updated.feedback_at,
      id,
    );
  return getRun(id);
}

export function appendAudit(
  run_id: string,
  workspace_id: string,
  action: string,
  details: unknown,
  actor: string | null,
): void {
  const database = getDb();
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO audit_logs (run_id, workspace_id, created_at, action, details, actor) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(run_id, workspace_id, now, action, JSON.stringify(details), actor);
}

export function getAuditLogs(run_id: string): AuditLogRecord[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM audit_logs WHERE run_id = ? ORDER BY id")
    .all(run_id) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    run_id: r.run_id as string,
    workspace_id: r.workspace_id as string,
    created_at: r.created_at as string,
    action: r.action as string,
    details: r.details != null ? JSON.parse(r.details as string) : undefined,
    actor: (r.actor as string) ?? null,
  }));
}

export function getWorkspace(id: string): Workspace | undefined {
  ensureWorkspace(id);
  const database = getDb();
  const row = database
    .prepare("SELECT * FROM workspaces WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row
    ? {
        id: row.id as string,
        name: row.name as string,
        tier: (row.tier as "free" | "pro") || "free",
        created_at: row.created_at as string,
      }
    : undefined;
}

/** Create a new workspace and return it. Used by dashboard when user signs up or creates a team. */
export function createWorkspace(name: string, id?: string): Workspace {
  const database = getDb();
  const workspaceId =
    id ??
    `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT OR IGNORE INTO workspaces (id, name, tier, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(workspaceId, name || workspaceId, "free", now);
  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error("Failed to create workspace");
  return ws;
}

export function getUsage(
  workspace_id: string,
  periodStart: string,
): { runs: number; deploys: number } {
  const database = getDb();
  const row = database
    .prepare(
      "SELECT runs, deploys FROM usage WHERE workspace_id = ? AND period_start = ?",
    )
    .get(workspace_id, periodStart) as
    | { runs: number; deploys: number }
    | undefined;
  return row
    ? { runs: row.runs, deploys: row.deploys }
    : { runs: 0, deploys: 0 };
}

export function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function incrementUsage(workspace_id: string, kind: "runs" | "deploys"): void {
  const period = currentPeriodStart();
  const database = getDb();
  const row = database
    .prepare(
      "SELECT runs, deploys FROM usage WHERE workspace_id = ? AND period_start = ?",
    )
    .get(workspace_id, period) as { runs: number; deploys: number } | undefined;
  if (row) {
    if (kind === "runs")
      database
        .prepare(
          "UPDATE usage SET runs = runs + 1 WHERE workspace_id = ? AND period_start = ?",
        )
        .run(workspace_id, period);
    else
      database
        .prepare(
          "UPDATE usage SET deploys = deploys + 1 WHERE workspace_id = ? AND period_start = ?",
        )
        .run(workspace_id, period);
  } else {
    database
      .prepare(
        "INSERT INTO usage (workspace_id, period_start, runs, deploys) VALUES (?, ?, ?, ?)",
      )
      .run(
        workspace_id,
        period,
        kind === "runs" ? 1 : 0,
        kind === "deploys" ? 1 : 0,
      );
  }
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
  const ws = getWorkspace(workspace_id);
  return (ws?.tier === "pro" ? LIMITS.pro : LIMITS.free).runs_per_month;
}

export function checkRunLimit(workspace_id: string): {
  allowed: boolean;
  current: number;
  limit: number;
} {
  ensureWorkspace(workspace_id);
  const period = currentPeriodStart();
  const { runs: current } = getUsage(workspace_id, period);
  const limit = getRunLimit(workspace_id);
  return { allowed: current < limit, current, limit };
}

export function setWorkspaceTier(
  workspace_id: string,
  tier: "free" | "pro",
): void {
  ensureWorkspace(workspace_id);
  getDb()
    .prepare("UPDATE workspaces SET tier = ? WHERE id = ?")
    .run(tier, workspace_id);
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
  const database = getDb();
  const { key, prefix, hash } = generateApiKey();
  const id = `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO api_keys (id, workspace_id, key_prefix, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, workspace_id, prefix, hash, name || "API key", now);
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
  const database = getDb();
  const row = database
    .prepare("SELECT workspace_id, key_hash FROM api_keys WHERE key_prefix = ?")
    .get(prefix) as { workspace_id: string; key_hash: string } | undefined;
  if (!row || row.key_hash !== keyHash) return null;
  return row.workspace_id;
}

export function listApiKeys(workspace_id: string): Omit<ApiKeyRecord, "key">[] {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT id, workspace_id, key_prefix, name, created_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(workspace_id) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    key_prefix: r.key_prefix as string,
    name: r.name as string,
    created_at: r.created_at as string,
  }));
}

export function revokeApiKey(workspace_id: string, keyId: string): boolean {
  const database = getDb();
  const result = database
    .prepare("DELETE FROM api_keys WHERE id = ? AND workspace_id = ?")
    .run(keyId, workspace_id);
  return result.changes > 0;
}

export function resolveWorkspaceFromApiKey(rawKey: string): string | null {
  const parsed = parseAndVerifyApiKey(rawKey);
  if (!parsed) return null;
  return getWorkspaceIdByApiKey(parsed.prefix, parsed.hash);
}
