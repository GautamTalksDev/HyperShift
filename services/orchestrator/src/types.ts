/** Run status as returned by API and expected by dashboard. */
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export interface UserIntent {
  description: string;
  target?: string;
  constraints?: string;
}

export interface RunRecord {
  id: string;
  status: RunStatus;
  current_step: number;
  error: string | null;
  user_intent: UserIntent;
  architect_output: unknown;
  builder_output: unknown;
  sentinel_output: unknown;
  sre_output: unknown;
  finops_output: unknown;
  created_at: string;
  updated_at: string;
  deployment_url: string | null;
  codename: string | null;
  tags: string[] | null;
  workspace_id: string;
  created_by: string | null;
  require_approval: boolean;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_step: string | null;
  duration_ms: number | null;
  feedback_useful: boolean | null;
  feedback_deploy_succeeded: boolean | null;
  feedback_at: string | null;
}

export interface AuditLogRecord {
  id: number;
  run_id: string;
  workspace_id: string;
  created_at: string;
  action: string;
  details: unknown;
  actor: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  tier: "free" | "pro";
  created_at: string;
}
