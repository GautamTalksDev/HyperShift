import type { RunDetail } from "@/lib/orchestrator";
import type { AgentStates, Connection } from "@/types";
import { agentOrder } from "@/utils/agents";

/** Map RunDetail (API) to AgentStates for globe/neural visualizations. */
export function runToAgentStates(run: RunDetail): AgentStates {
  const status = run.status;
  const step = run.current_step;
  const states: AgentStates = {
    architect: "idle",
    builder: "idle",
    sentinel: "idle",
    sre: "idle",
    finops: "idle",
  };
  if (status === "completed") {
    agentOrder.forEach((id) => {
      states[id] = "complete";
    });
    return states;
  }
  if (status === "blocked") {
    states.architect = "complete";
    states.builder = "complete";
    states.sentinel = "blocked";
    return states;
  }
  if (status === "failed") {
    for (let i = 0; i < step - 1 && i < agentOrder.length; i++)
      states[agentOrder[i]!] = "complete";
    if (step >= 1 && step <= agentOrder.length)
      states[agentOrder[step - 1]!] = "failed";
    return states;
  }
  if (status === "running") {
    for (let i = 0; i < step - 1 && i < agentOrder.length; i++)
      states[agentOrder[i]!] = "complete";
    if (step >= 1 && step <= agentOrder.length)
      states[agentOrder[step - 1]!] = "active";
    return states;
  }
  return states;
}

/** Build connections for neural/globe from current step. */
export function runToConnections(run: RunDetail): Connection[] {
  const status = run.status;
  const step = run.current_step;
  const connections: Connection[] = [];
  const n = agentOrder.length;
  for (let i = 0; i < n - 1; i++) {
    const from = agentOrder[i]!;
    const to = agentOrder[i + 1]!;
    const active =
      status === "running"
        ? step > i + 1
        : status === "completed"
          ? true
          : status === "blocked"
            ? i + 1 < 3
            : false;
    connections.push({ from, to, active, timestamp: run.updated_at });
  }
  return connections;
}

/** Short "thinking" line per step (for thinking-mode / streaming copy). */
export function getThinkingLine(step: number, run: RunDetail): string {
  const names: Record<number, string> = {
    1: "Architect",
    2: "Builder",
    3: "Sentinel",
    4: "SRE",
    5: "FinOps",
  };
  const name = names[step] ?? "Agent";
  const out =
    step === 1
      ? run.architect_output
      : step === 2
        ? run.builder_output
        : step === 3
          ? run.sentinel_output
          : step === 4
            ? run.sre_output
            : run.finops_output;
  if (step === 1 && out && typeof out === "object" && "appPlan" in out) {
    const plan = out as { appPlan?: { name?: string }[] };
    const stack = plan.appPlan?.[0]?.name ?? "Next.js";
    return `${name}: Choosing ${stack} and drafting blueprint…`;
  }
  if (step === 2 && out)
    return `${name}: Building repo structure and deploy plan…`;
  if (step === 3 && out) {
    const v = out as { veto?: boolean };
    return v.veto
      ? `${name}: Blocking deploy — security findings.`
      : `${name}: Security scan passed.`;
  }
  if (step === 4 && out) {
    const s = out as { rollbackAction?: string };
    return s.rollbackAction === "recommended" || s.rollbackAction === "required"
      ? `${name}: Recommending rollback.`
      : `${name}: Health checks OK.`;
  }
  if (step === 5 && out) {
    const f = out as { estimatedMonthlyCost?: number };
    const cost = f.estimatedMonthlyCost ?? 0;
    return `${name}: Estimated $${cost}/mo.`;
  }
  return `${name}: Reasoning…`;
}

/** Natural-language explanation for a step (e.g. why Sentinel blocked). */
export function getStepExplanation(step: number, run: RunDetail): string {
  if (
    step === 3 &&
    run.sentinel_output &&
    typeof run.sentinel_output === "object"
  ) {
    const report = run.sentinel_output as {
      veto?: boolean;
      findings?: { title?: string; path?: string; severity?: string }[];
    };
    if (
      report.veto &&
      Array.isArray(report.findings) &&
      report.findings.length > 0
    ) {
      const first = report.findings[0];
      const where = first.path ? ` in ${first.path}` : "";
      return `Sentinel blocked because a ${first.severity ?? "high"}-severity finding was found${where}: ${first.title ?? "Security issue"}.`;
    }
    if (report.veto)
      return "Sentinel blocked because the security scan reported high or critical findings.";
  }
  if (step === 4 && run.sre_output && typeof run.sre_output === "object") {
    const s = run.sre_output as {
      rollbackAction?: string;
      incidents?: { title?: string }[];
    };
    if (s.rollbackAction === "recommended" || s.rollbackAction === "required") {
      const incident = s.incidents?.[0]?.title;
      return incident
        ? `SRE recommends rollback due to: ${incident}.`
        : "SRE recommends rollback due to health/incident checks.";
    }
  }
  return getThinkingLine(step, run);
}
