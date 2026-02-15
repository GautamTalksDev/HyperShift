const env = {
  ORCHESTRATOR_PORT: Number(process.env.ORCHESTRATOR_PORT) || 4001,
  HOST: process.env.HOST || "0.0.0.0",
  /** SQLite path for persistent store. If unset, uses in-memory store. */
  DATABASE_PATH:
    process.env.ORCHESTRATOR_DATABASE_PATH ?? process.env.DATABASE_PATH ?? "",
  ARCHITECT_AGENT_URL: process.env.ARCHITECT_AGENT_URL || "",
  BUILDER_AGENT_URL: process.env.BUILDER_AGENT_URL || "",
  SENTINEL_AGENT_URL: process.env.SENTINEL_AGENT_URL || "",
  SRE_AGENT_URL: process.env.SRE_AGENT_URL || "",
  FINOPS_AGENT_URL: process.env.FINOPS_AGENT_URL || "",
  AGENT_TIMEOUT_MS: Number(process.env.AGENT_TIMEOUT_MS) || 60_000,
  DEPLOY_BUILD_BASE_DIR: process.env.DEPLOY_BUILD_BASE_DIR || "",
  VERCEL_TOKEN: process.env.VERCEL_TOKEN || "",
  /** Delay in ms between pipeline steps so the UI can update (default 2.5s). Set to 0 to run fast. */
  PIPELINE_STEP_DELAY_MS: Number(process.env.PIPELINE_STEP_DELAY_MS) ?? 2500,
  /** Optional secret for tier updates (e.g. from Stripe webhook). If set, PATCH /workspaces/:id/tier must send X-Webhook-Secret. */
  WORKSPACE_TIER_UPDATE_SECRET: process.env.WORKSPACE_TIER_UPDATE_SECRET ?? "",
  /** Optional Redis URL for job queue. If set, run pipeline jobs are enqueued and processed by worker(s). If unset, runs execute in-process (setImmediate). */
  REDIS_URL: process.env.REDIS_URL ?? process.env.HYPERSHIFT_REDIS_URL ?? "",
};
export { env };
