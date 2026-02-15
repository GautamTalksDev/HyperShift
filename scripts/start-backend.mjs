#!/usr/bin/env node
/**
 * Start the full HyperShift backend (API, Orchestrator, all agents) plus the
 * single-port proxy. Use this for production deploy (Render, Railway, Fly.io).
 * Expects: run from repo root, after `pnpm build`.
 * The proxy listens on process.env.PORT and forwards /api -> API, / -> Orchestrator.
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
  BUILDER_AGENT_PORT: "4003",
  SENTINEL_AGENT_PORT: "4004",
  SRE_AGENT_PORT: "4005",
  FINOPS_AGENT_PORT: "4006",
  ARCHITECT_AGENT_URL: "http://127.0.0.1:4002",
  BUILDER_AGENT_URL: "http://127.0.0.1:4003",
  SENTINEL_AGENT_URL: "http://127.0.0.1:4004",
  SRE_AGENT_URL: "http://127.0.0.1:4005",
  FINOPS_AGENT_URL: "http://127.0.0.1:4006",
};

const services = [
  { name: "api", cwd: path.join(root, "apps/api"), script: "node dist/index.js" },
  { name: "orchestrator", cwd: path.join(root, "services/orchestrator"), script: "node dist/index.js" },
  { name: "architect", cwd: path.join(root, "services/architect-agent"), script: "node dist/index.js" },
  { name: "builder", cwd: path.join(root, "services/builder-agent"), script: "node dist/index.js" },
  { name: "sentinel", cwd: path.join(root, "services/sentinel-agent"), script: "node dist/index.js" },
  { name: "sre", cwd: path.join(root, "services/sre-agent"), script: "node dist/index.js" },
  { name: "finops", cwd: path.join(root, "services/finops-agent"), script: "node dist/index.js" },
];

const children = [];

function run(name, cwd, script, env) {
  // Use shell so Render's runtime PATH is used to resolve 'node' (execPath can be invalid at runtime)
  const child = spawn(script, [], {
    cwd,
    env: { ...baseEnv, ...env },
    stdio: "inherit",
    shell: true,
  });
  child.on("error", (err) => console.error(`[${name}] error:`, err));
  child.on("exit", (code, sig) => {
    if (code !== null && code !== 0) console.error(`[${name}] exited ${code}`);
    if (sig) console.error(`[${name}] signal ${sig}`);
  });
  children.push({ name, child });
  return child;
}

// Start all backend services
for (const s of services) {
  run(s.name, s.cwd, s.script, {});
}

// Start proxy last (uses PORT from env)
const proxyScript = path.join(__dirname, "proxy.mjs");
run("proxy", root, `node ${proxyScript}`, {});

process.on("SIGINT", () => {
  for (const { name, child } of children) {
    child.kill("SIGTERM");
    console.log(`[${name}] stopped`);
  }
  process.exit(0);
});
