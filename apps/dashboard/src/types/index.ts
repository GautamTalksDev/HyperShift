// UI THEME LOCKED

import type { AgentId as SharedAgentId } from "@hypershift/shared";

// Core agent identifiers (dashboard focuses on the 5 worker agents).
export type AgentId = Exclude<SharedAgentId, "orchestrator">;

// UI-facing lifecycle state for an individual agent in a run.
export type AgentStatus = "idle" | "active" | "complete" | "blocked" | "failed";

// Global deployment state used by the dashboard (derived from per-agent status).
export type DeploymentState = "READY" | "RUNNING" | "BLOCKED" | "COMPLETE";

// High-level deployment metadata for demo workflows.
export interface DeploymentInfo {
  id: string;
  url: string;
  type: "mission" | "happy_path";
}

// Log levels for agent and orchestrator logs surfaced in the UI.
export type LogLevel = "debug" | "info" | "warn" | "error";

// Canonical agent model for dashboard views and utilities.
export interface Agent {
  id: AgentId;
  name: string;
  /**
   * Tailwind or semantic color token describing the agent’s primary accent.
   * This should reuse existing palette entries only (no new colors).
   */
  color: string;
}

// Per-agent status map keyed by AgentId.
export type AgentStates = Record<AgentId, AgentStatus>;

// Log entry as consumed by the dashboard mission control & terminal views.
export interface LogEntry {
  timestamp: string;
  agent: AgentId;
  message: string;
  level: LogLevel;
  location?: string;
}

// Edge between two agents in the orchestrator graph.
export interface Connection {
  from: AgentId;
  to: AgentId;
  active: boolean;
  timestamp: string;
}

// Attack modeling for sabotage / security demos.
export type AttackType = "happy_path" | "sabotage" | "timeout" | "rollback";

export type AttackStatus = "idle" | "running" | "success" | "blocked";

/** Template id for happy-path and demo flows (used by projectTemplates in utils/agents). */
export type TemplateId =
  | "nextjs-landing-happy-path"
  | "sabotage-demo"
  | "nextjs-api-free-tier"
  | "static-site-local";
