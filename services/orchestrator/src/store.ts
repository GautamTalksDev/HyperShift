/**
 * Store: in-memory (default) or SQLite when ORCHESTRATOR_DATABASE_PATH is set.
 * Same API for runs, workspaces, usage, and audit log.
 */
import { env } from "./env.js";
import * as memory from "./store-memory.js";
import * as sqlite from "./store-sqlite.js";

let useSqlite = false;

export function initStore(): void {
  if (env.DATABASE_PATH) {
    sqlite.initSqliteStore(env.DATABASE_PATH);
    useSqlite = true;
  }
}

const backend = (): typeof memory => (useSqlite ? sqlite : memory);

export const createRun = (...args: Parameters<typeof memory.createRun>) =>
  backend().createRun(...args);
export const getRun = (...args: Parameters<typeof memory.getRun>) =>
  backend().getRun(...args);
export const listRuns = (...args: Parameters<typeof memory.listRuns>) =>
  backend().listRuns(...args);
export const updateRun = (...args: Parameters<typeof memory.updateRun>) =>
  backend().updateRun(...args);
export const appendAudit = (...args: Parameters<typeof memory.appendAudit>) =>
  backend().appendAudit(...args);
export const getAuditLogs = (...args: Parameters<typeof memory.getAuditLogs>) =>
  backend().getAuditLogs(...args);
export const getWorkspace = (...args: Parameters<typeof memory.getWorkspace>) =>
  backend().getWorkspace(...args);
export const createWorkspace = (
  ...args: Parameters<typeof memory.createWorkspace>
) => backend().createWorkspace(...args);
export const getUsage = (...args: Parameters<typeof memory.getUsage>) =>
  backend().getUsage(...args);
export const currentPeriodStart = (
  ...args: Parameters<typeof memory.currentPeriodStart>
) => backend().currentPeriodStart(...args);
export const recordDeploy = (...args: Parameters<typeof memory.recordDeploy>) =>
  backend().recordDeploy(...args);
export const getRunOutcomes = (
  ...args: Parameters<typeof memory.getRunOutcomes>
) => backend().getRunOutcomes(...args);
export const LIMITS = memory.LIMITS;
export const getRunLimit = (...args: Parameters<typeof memory.getRunLimit>) =>
  backend().getRunLimit(...args);
export const checkRunLimit = (
  ...args: Parameters<typeof memory.checkRunLimit>
) => backend().checkRunLimit(...args);
export const setWorkspaceTier = (
  ...args: Parameters<typeof memory.setWorkspaceTier>
) => backend().setWorkspaceTier(...args);
export const createApiKey = (...args: Parameters<typeof memory.createApiKey>) =>
  backend().createApiKey(...args);
export const listApiKeys = (...args: Parameters<typeof memory.listApiKeys>) =>
  backend().listApiKeys(...args);
export const revokeApiKey = (...args: Parameters<typeof memory.revokeApiKey>) =>
  backend().revokeApiKey(...args);
export const resolveWorkspaceFromApiKey = (
  ...args: Parameters<typeof memory.resolveWorkspaceFromApiKey>
) => backend().resolveWorkspaceFromApiKey(...args);
