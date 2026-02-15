#!/usr/bin/env node
/**
 * Start the full HyperShift backend (API, Orchestrator, all agents) plus the
 * single-port proxy. Use this for production deploy (Render, Railway, Fly.io).
 * Expects: run from repo root, after `pnpm build`.
 * The proxy listens on process.env.PORT and forwards /api -> API, / -> Orchestrator.
 */
import { spawn } from "child_process";
import net from "net";
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

// Use 'env node' so the runner finds node from PATH (Render runtime may not have execPath)
const nodeCmd = "env node";
const services = [
  { name: "api", cwd: path.join(root, "apps/api"), script: `${nodeCmd} dist/index.js` },
  { name: "orchestrator", cwd: path.join(root, "services/orchestrator"), script: `${nodeCmd} dist/index.js` },
  { name: "architect", cwd: path.join(root, "services/architect-agent"), script: `${nodeCmd} dist/index.js` },
  { name: "builder", cwd: path.join(root, "services/builder-agent"), script: `${nodeCmd} dist/index.js` },
  { name: "sentinel", cwd: path.join(root, "services/sentinel-agent"), script: `${nodeCmd} dist/index.js` },
  { name: "sre", cwd: path.join(root, "services/sre-agent"), script: `${nodeCmd} dist/index.js` },
  { name: "finops", cwd: path.join(root, "services/finops-agent"), script: `${nodeCmd} dist/index.js` },
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
  run(s.name, s.cwd, s.script, {});
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
  run("proxy", root, `${nodeCmd} ${proxyScript}`, {});
})();

process.on("SIGINT", () => {
  for (const { name, child } of children) {
    child.kill("SIGTERM");
    console.log(`[${name}] stopped`);
  }
  process.exit(0);
});
