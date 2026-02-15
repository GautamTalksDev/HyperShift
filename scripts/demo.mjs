#!/usr/bin/env node
/**
 * Waits for the dashboard to be up, opens it in the browser, and prints demo steps.
 * Run with: pnpm demo (which runs this alongside pnpm dev via concurrently).
 */

import { spawn } from "child_process";

const DASHBOARD_URL = "http://localhost:3000";
const MAX_WAIT_MS = 25_000;
const POLL_INTERVAL_MS = 800;

function openUrl(url) {
  const { platform } = process;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", shell: true }).unref();
  } else if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { stdio: "ignore" }).unref();
  }
}

function waitForDashboard() {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryFetch = () => {
      fetch(DASHBOARD_URL, { method: "HEAD", signal: AbortSignal.timeout(2000) })
        .then(() => resolve(true))
        .catch(() => {
          if (Date.now() - start > MAX_WAIT_MS) resolve(false);
          else setTimeout(tryFetch, POLL_INTERVAL_MS);
        });
    };
    tryFetch();
  });
}

function printDemoSteps() {
  const steps = `
╔══════════════════════════════════════════════════════════════════╗
║  HyperShift — Demo steps                                        ║
╠══════════════════════════════════════════════════════════════════╣
║  1. Dashboard is open at ${DASHBOARD_URL}                        ║
║                                                                  ║
║  2. Happy Path: Click "Happy Path" → run completes, all green.   ║
║                                                                  ║
║  3. Sabotage Deploy: Click "Sabotage Deploy" → Sentinel blocks   ║
║     (fake hardcoded key in build → security veto).               ║
║                                                                  ║
║  4. SRE sabotage (optional):                                    ║
║     • curl -X POST http://localhost:4000/sabotage                ║
║     • Start a run; SRE step may report incident + rollback.      ║
║     • curl -X POST http://localhost:4000/sabotage (toggle back) ║
╚══════════════════════════════════════════════════════════════════╝
`;
  console.log(steps);
}

async function main() {
  console.log("Waiting for dashboard to be ready…");
  const ok = await waitForDashboard();
  if (ok) {
    openUrl(DASHBOARD_URL);
    printDemoSteps();
  } else {
    console.log("Dashboard did not start in time. Open http://localhost:3000 manually.");
  }
}

main();
