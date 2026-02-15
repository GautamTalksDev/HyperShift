import { env } from "./env.js";

const TIMEOUT_MS = env.AGENT_TIMEOUT_MS;

async function fetchAgent(
  url: string,
  path: string,
  body: unknown,
): Promise<unknown> {
  const fullUrl = `${url.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Agent ${path} returned ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

/** Stub blueprint for when architect is not configured. */
function stubBlueprint(user_intent: {
  description?: string;
  target?: string;
  constraints?: string;
}): unknown {
  return {
    version: "1.0",
    appName: "app",
    appPlan: [{ id: "web", name: "Next.js", type: "web", config: {} }],
    infra: [{ id: "host", type: "vercel", config: {} }],
    _stub: true,
    _intent: user_intent,
  };
}

/** Stub build plan. */
function stubBuildPlan(): unknown {
  return { buildSteps: ["install", "build"], outputDir: "out", _stub: true };
}

/** Stub security report (no veto). */
function stubSecurityReport(): unknown {
  return { veto: false, findings: [], _stub: true };
}

/** Stub SRE status. */
function stubSreStatus(): unknown {
  return { rollbackAction: "none", incidents: [], _stub: true };
}

/** Stub FinOps report. */
function stubFinOpsReport(): unknown {
  return { estimatedMonthlyCost: 0, currency: "USD", _stub: true };
}

export async function callArchitect(user_intent: {
  description: string;
  target?: string;
  constraints?: string;
}): Promise<unknown> {
  if (env.ARCHITECT_AGENT_URL) {
    return fetchAgent(env.ARCHITECT_AGENT_URL, "/architect", { user_intent });
  }
  return stubBlueprint(user_intent);
}

export async function callBuilder(
  user_intent: { description: string; target?: string; constraints?: string },
  blueprint_manifest: unknown,
): Promise<unknown> {
  if (env.BUILDER_AGENT_URL) {
    return fetchAgent(env.BUILDER_AGENT_URL, "/builder", {
      user_intent,
      blueprint_manifest,
    });
  }
  return stubBuildPlan();
}

export async function callSentinel(
  blueprint_manifest: unknown,
  build_plan: unknown,
): Promise<unknown> {
  if (env.SENTINEL_AGENT_URL) {
    return fetchAgent(env.SENTINEL_AGENT_URL, "/sentinel", {
      blueprint_manifest,
      build_plan,
    });
  }
  return stubSecurityReport();
}

export async function callSre(
  deployment_url: string | null,
  run_id: string,
): Promise<unknown> {
  if (env.SRE_AGENT_URL) {
    return fetchAgent(env.SRE_AGENT_URL, "/sre/check", {
      deployment_url,
      run_id,
    });
  }
  return stubSreStatus();
}

export async function callFinOps(
  blueprint_manifest: unknown,
  infra?: unknown,
): Promise<unknown> {
  if (env.FINOPS_AGENT_URL) {
    return fetchAgent(env.FINOPS_AGENT_URL, "/finops", {
      blueprint_manifest,
      infra,
    });
  }
  return stubFinOpsReport();
}
