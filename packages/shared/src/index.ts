/** Agent identifiers including orchestrator (dashboard uses Exclude<AgentId, "orchestrator"> for worker agents). */
export type AgentId =
  | "orchestrator"
  | "architect"
  | "builder"
  | "sentinel"
  | "sre"
  | "finops";

/** Generate a unique request/run id. */
export function createRequestId(): string {
  const prefix = "req";
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${random}`;
}
