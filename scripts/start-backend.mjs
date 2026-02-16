#!/usr/bin/env node
/**
 * Start the full HyperShift backend (API, Orchestrator, all agents) plus the
 * single-port proxy. Use this for production deploy (Render, Railway, Fly.io).
 * Expects: run from repo root, after `pnpm build`.
 * The proxy listens on process.env.PORT and forwards /api -> API, / -> Orchestrator.
 * Only starts services whose directories exist; orchestrator uses stubs for missing agents.
 */
import { spawn } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const hasBuilder = fs.existsSync(path.join(root, "services/builder-agent"));
const hasSentinel = fs.existsSync(path.join(root, "services/sentinel-agent"));
const hasSre = fs.existsSync(path.join(root, "services/sre-agent"));
const hasFinops = fs.existsSync(path.join(root, "services/finops-agent"));

const baseEnv = {
  ...process.env,
  API_PORT: "4000",
  API_HOST: "0.0.0.0",
  ORCHESTRATOR_PORT: "4001",
  HOST: "0.0.0.0",
  ARCHITECT_AGENT_PORT: "4002",
  ARCHITECT_AGENT_URL: "http://127.0.0.1:4002",
  ...(hasBuilder ? { BUILDER_AGENT_PORT: "4003", BUILDER_AGENT_URL: "http://127.0.0.1:4003" } : {}),
  ...(hasSentinel ? { SENTINEL_AGENT_PORT: "4004", SENTINEL_AGENT_URL: "http://127.0.0.1:4004" } : {}),
  ...(hasSre ? { SRE_AGENT_PORT: "4005", SRE_AGENT_URL: "http://127.0.0.1:4005" } : {}),
  ...(hasFinops ? { FINOPS_AGENT_PORT: "4006", FINOPS_AGENT_URL: "http://127.0.0.1:4006" } : {}),
};

// Spawn node directly (no shell) so we work on Render where /bin/sh may not exist
const node = process.execPath;
const allServices = [
  { name: "api", cwd: path.join(root, "apps/api"), args: ["dist/index.js"] },
  { name: "orchestrator", cwd: path.join(root, "services/orchestrator"), args: ["dist/index.js"] },
  { name: "architect", cwd: path.join(root, "services/architect-agent"), args: ["dist/index.js"] },
  { name: "builder", cwd: path.join(root, "services/builder-agent"), args: ["dist/index.js"] },
  { name: "sentinel", cwd: path.join(root, "services/sentinel-agent"), args: ["dist/index.js"] },
  { name: "sre", cwd: path.join(root, "services/sre-agent"), args: ["dist/index.js"] },
  { name: "finops", cwd: path.join(root, "services/finops-agent"), args: ["dist/index.js"] },
];
const services = allServices.filter((s) => fs.existsSync(s.cwd));

const children = [];

function run(name, cwd, args, env) {
  const child = spawn(node, args, {
    cwd,
    env: { ...baseEnv, ...env },
    stdio: "inherit",
  });
  child.on("error", (err) => console.error(`[${name}] error:`, err));
  child.on("exit", (code, sig) => {
    if (code !== null && code !== 0) console.error(`[${name}] exited ${code}`);
    if (sig) console.error(`[${name}] signal ${sig}`);
  });
  children.push({ name, child });
  return child;
}

/** Wait for a port to accept connections (used so proxy doesn't start before backends). */
function waitForPort(host, port, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = new net.Socket();
      const onError = () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`${label} (${host}:${port}) did not become ready in time`));
          return;
        }
        setTimeout(tryConnect, 500);
      };
      socket.setTimeout(2000, () => {
        socket.destroy();
        onError();
      });
      socket.once("error", onError);
      socket.once("connect", () => {
        socket.destroy();
        console.log(`[start] ${label} ready on ${host}:${port}`);
        resolve();
      });
      socket.connect(port, host);
    };
    tryConnect();
  });
}

// Start all backend services
for (const s of services) {
  run(s.name, s.cwd, s.args, {});
}

// Wait for API and Orchestrator to listen, then start proxy (avoids ECONNREFUSED on Render health check)
(async () => {
  try {
    await Promise.all([
      waitForPort("127.0.0.1", 4000, "API", 30000),
      waitForPort("127.0.0.1", 4001, "Orchestrator", 30000),
    ]);
  } catch (err) {
    console.error("[start] Backends did not become ready:", err.message);
    process.exit(1);
  }
  const proxyScript = path.join(__dirname, "proxy.mjs");
  run("proxy", root, [proxyScript], {});
})();

process.on("SIGINT", () => {
  for (const { name, child } of children) {
    child.kill("SIGTERM");
    console.log(`[${name}] stopped`);
  }
  process.exit(0);
});
