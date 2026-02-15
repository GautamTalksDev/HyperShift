#!/usr/bin/env node
/**
 * Start HyperShift in development: orchestrator, API, architect agent, and dashboard.
 * Run from repo root. Ensures the orchestrator is running so the dashboard can connect.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const baseEnv = {
  ...process.env,
  API_PORT: "4000",
  API_HOST: "0.0.0.0",
  ORCHESTRATOR_PORT: "4001",
  HOST: "0.0.0.0",
  ARCHITECT_AGENT_PORT: "4002",
  ARCHITECT_AGENT_URL: "http://127.0.0.1:4002",
};

const children = [];

function run(name, cwd, command, args = [], env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...baseEnv, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("error", (err) => console.error(`[${name}] error:`, err));
  child.on("exit", (code, sig) => {
    if (code !== null && code !== 0) console.error(`[${name}] exited ${code}`);
    if (sig) console.error(`[${name}] signal ${sig}`);
  });
  children.push({ name, child });
  return child;
}

// Orchestrator first (dashboard depends on it)
run("orchestrator", path.join(root, "services/orchestrator"), "pnpm", ["exec", "tsx", "watch", "src/index.ts"]);

// API
run("api", path.join(root, "apps/api"), "pnpm", ["exec", "tsx", "watch", "src/index.ts"]);

// Architect agent
run("architect", path.join(root, "services/architect-agent"), "pnpm", ["exec", "tsx", "watch", "src/index.ts"]);

// Dashboard
run("dashboard", path.join(root, "apps/dashboard"), "pnpm", ["run", "dev"]);

process.on("SIGINT", () => {
  for (const { name, child } of children) {
    child.kill("SIGTERM");
    console.log(`[${name}] stopped`);
  }
  process.exit(0);
});
