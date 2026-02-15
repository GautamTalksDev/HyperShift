#!/usr/bin/env node
/**
 * HyperShift CLI — create runs, list runs, get logs.
 * Set HYPERSHIFT_ORCHESTRATOR_URL (default http://localhost:4001) and optional
 * HYPERSHIFT_WORKSPACE_ID, HYPERSHIFT_USER_ID.
 */

const BASE = process.env.HYPERSHIFT_ORCHESTRATOR_URL || "http://localhost:4001";
const WORKSPACE =
  process.env.HYPERSHIFT_WORKSPACE_ID || process.env.HYPERSHIFT_ORG_ID;
const USER = process.env.HYPERSHIFT_USER_ID;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (WORKSPACE) h["X-Workspace-Id"] = WORKSPACE;
  if (USER) h["X-User-Id"] = USER;
  return h;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  return fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(`
hypershift — HyperShift CLI

Usage:
  hypershift run <description>     Create and start a run (description can be quoted)
  hypershift runs list             List runs
  hypershift runs get <id>         Get run details
  hypershift runs logs <id>        Get audit logs for a run
  hypershift runs start <id>       Start a pending run

Env:
  HYPERSHIFT_ORCHESTRATOR_URL  Orchestrator base URL (default: http://localhost:4001)
  HYPERSHIFT_WORKSPACE_ID      Workspace/org (optional)
  HYPERSHIFT_USER_ID           User/actor for audit (optional)
`);
    process.exit(0);
    return;
  }

  if (cmd === "run") {
    const description = args.slice(1).join(" ").trim() || "Deploy my app";
    const res = await api("POST", "/runs", {
      user_intent: { description },
    });
    const data = (await res.json()) as { run_id?: string; error?: string };
    if (!res.ok) {
      console.error(data.error ?? "Failed to create run");
      process.exit(1);
    }
    const runId = data.run_id!;
    const startRes = await api("POST", `/runs/${runId}/start`);
    if (!startRes.ok)
      console.error("Run created but start failed:", await startRes.text());
    else console.log("Run created and started:", runId);
    console.log(
      "Dashboard:",
      `${BASE.replace(/\/$/, "").replace(/:\d+$/, ":3000")}/runs/${runId}`,
    );
    return;
  }

  if (cmd === "runs") {
    const sub = args[1];
    if (sub === "list") {
      const res = await api("GET", "/runs");
      const data = (await res.json()) as {
        runs?: { id: string; status: string; created_at: string }[];
      };
      if (!res.ok) {
        console.error(
          "Failed to list runs:",
          (data as { error?: string }).error,
        );
        process.exit(1);
      }
      const runs = data.runs ?? [];
      if (runs.length === 0) console.log("No runs.");
      else
        runs.forEach((r) =>
          console.log(`${r.id}\t${r.status}\t${r.created_at}`),
        );
      return;
    }
    if (sub === "get") {
      const id = args[2];
      if (!id) {
        console.error("Usage: hypershift runs get <run_id>");
        process.exit(1);
      }
      const res = await api("GET", `/runs/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        console.error((data as { error?: string }).error ?? "Not found");
        process.exit(1);
      }
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (sub === "logs") {
      const id = args[2];
      if (!id) {
        console.error("Usage: hypershift runs logs <run_id>");
        process.exit(1);
      }
      const res = await api("GET", `/runs/${encodeURIComponent(id)}/logs`);
      const data = (await res.json()) as {
        logs?: { action: string; created_at: string; details?: unknown }[];
      };
      if (!res.ok) {
        console.error("Failed to get logs");
        process.exit(1);
      }
      const logs = data.logs ?? [];
      logs.forEach((e) =>
        console.log(
          `${e.created_at}\t${e.action}\t${JSON.stringify(e.details ?? {})}`,
        ),
      );
      return;
    }
    if (sub === "start") {
      const id = args[2];
      if (!id) {
        console.error("Usage: hypershift runs start <run_id>");
        process.exit(1);
      }
      const res = await api("POST", `/runs/${encodeURIComponent(id)}/start`);
      const data = await res.json();
      if (!res.ok && res.status !== 202) {
        console.error((data as { error?: string }).error ?? "Failed to start");
        process.exit(1);
      }
      console.log("Run started:", id);
      return;
    }
  }

  console.error("Unknown command. Use: hypershift help");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
