import type { RunDetail, AuditLogEntry } from "@/lib/orchestrator";
import { jsPDF } from "jspdf";

const RECEIPT_ALGORITHM = "SHA-256";

const AGENT_NAMES: Record<number, string> = {
  1: "Architect",
  2: "Builder",
  3: "Sentinel",
  4: "SRE",
  5: "FinOps",
};

/** Build a canonical string for hashing: run identity + audit log content (append-only order). */
function canonicalPayload(run: RunDetail, logs: AuditLogEntry[]): string {
  const runPart = {
    id: run.id,
    status: run.status,
    current_step: run.current_step,
    created_at: run.created_at,
    updated_at: run.updated_at,
    error: run.error,
    user_intent: run.user_intent,
  };
  const auditPart = logs.map((e) => ({
    id: e.id,
    run_id: e.run_id,
    created_at: e.created_at,
    action: e.action,
    details: e.details,
  }));
  return JSON.stringify({ run: runPart, audit: auditPart });
}

/** Compute SHA-256 hash of canonical run + audit (hex). */
async function computeReceiptHash(
  run: RunDetail,
  logs: AuditLogEntry[],
): Promise<string> {
  const payload = canonicalPayload(run, logs);
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function runDurationMs(run: RunDetail): number {
  return (
    new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()
  );
}

function runOutcomeSentence(run: RunDetail): string {
  if (run.status === "completed")
    return "Deployment pipeline completed successfully.";
  if (run.status === "blocked")
    return "Blocked by Sentinel – security findings.";
  if (run.status === "failed")
    return `Pipeline failed at step ${run.current_step}.`;
  return `Run ${run.status}.`;
}

function stepStatusLabel(run: RunDetail, step: number): string {
  const { status, current_step } = run;
  if (status === "completed") return "done";
  if (status === "blocked") {
    if (step < 3) return "done";
    if (step === 3) return "blocked";
    return "pending";
  }
  if (status === "failed") {
    if (step < current_step) return "done";
    if (step === current_step) return "failed";
    return "pending";
  }
  if (status === "running") {
    if (step < current_step) return "done";
    if (step === current_step) return "running";
    return "pending";
  }
  return "pending";
}

/** One bullet of key output per agent for pipeline section. */
function oneBulletForStep(step: number, run: RunDetail): string {
  switch (step) {
    case 1:
      if (run.architect_output && typeof run.architect_output === "object") {
        const a = run.architect_output as {
          appPlan?: { name?: string }[];
          appName?: string;
        };
        const stack = a.appPlan?.[0]?.name ?? "—";
        return `Blueprint: ${stack}.`;
      }
      return "—";
    case 2:
      if (
        run.builder_output != null &&
        typeof run.builder_output === "object"
      ) {
        const b = run.builder_output as { buildSteps?: string[] };
        const first = Array.isArray(b.buildSteps) ? b.buildSteps[0] : null;
        return first
          ? `Build: ${String(first).slice(0, 80)}…`
          : "Build plan generated.";
      }
      return "—";
    case 3:
      if (run.sentinel_output && typeof run.sentinel_output === "object") {
        const s = run.sentinel_output as { veto?: boolean };
        return s.veto ? "Security: blocked." : "Security: passed.";
      }
      return "—";
    case 4:
      if (run.sre_output && typeof run.sre_output === "object") {
        const s = run.sre_output as { rollbackAction?: string };
        return `SRE: rollback ${s.rollbackAction ?? "—"}.`;
      }
      return "—";
    case 5:
      if (run.finops_output && typeof run.finops_output === "object") {
        const f = run.finops_output as {
          estimatedMonthlyCost?: number;
          currency?: string;
        };
        return `FinOps: ${f.currency ?? "USD"} ${f.estimatedMonthlyCost ?? 0}/mo.`;
      }
      return "—";
    default:
      return "—";
  }
}

function formatOutputSection(obj: unknown): string[] {
  if (obj == null) return ["—"];
  if (typeof obj !== "object") return [String(obj)];
  const lines: string[] = [];
  const o = obj as Record<string, unknown>;
  if (Array.isArray(o)) {
    o.slice(0, 10).forEach((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "title" in (item as object)
      )
        lines.push(
          `• ${(item as { title?: string }).title ?? JSON.stringify(item)}`,
        );
      else lines.push(`• ${JSON.stringify(item)}`);
    });
    if (o.length > 10) lines.push(`… and ${o.length - 10} more`);
    return lines.length ? lines : ["—"];
  }
  const skip = new Set(["findings", "incidents", "appPlan", "details"]);
  for (const [k, v] of Object.entries(o)) {
    if (skip.has(k) || v == null) continue;
    if (typeof v === "string") lines.push(`${k}: ${v}`);
    else if (typeof v === "number" || typeof v === "boolean")
      lines.push(`${k}: ${v}`);
    else if (Array.isArray(v)) lines.push(`${k}: ${v.length} item(s)`);
    else lines.push(`${k}: ${JSON.stringify(v).slice(0, 80)}`);
  }
  return lines.length ? lines : ["—"];
}

/** Export PDF with cover page, executive summary, pipeline section, appendix (audit log + receipt). */
export async function exportRunToPdf(
  run: RunDetail,
  logs: AuditLogEntry[],
): Promise<void> {
  const receiptHash = await computeReceiptHash(run, logs);
  const receiptTimestamp = new Date().toISOString();
  const durationMs = runDurationMs(run);
  const durationSec = (durationMs / 1000).toFixed(1);
  const agentsExecuted =
    run.status === "completed"
      ? 5
      : run.status === "blocked"
        ? 3
        : run.current_step;
  const outcome = runOutcomeSentence(run);
  const intent = run.user_intent?.description ?? "—";

  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const margin = 40;
  const width = doc.internal.pageSize.width - margin * 2;
  const pageHeight = doc.internal.pageSize.height;
  const lineHeight = 14;
  const footerHeight = 22;
  let y = margin;

  function newPageIfNeeded(need: number) {
    if (y + need > pageHeight - margin - footerHeight) {
      doc.addPage();
      y = margin;
    }
  }

  function addText(text: string, opts?: { font?: string; size?: number }) {
    doc.setFontSize(opts?.size ?? 10);
    if (opts?.font) doc.setFont("helvetica", opts.font);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      newPageIfNeeded(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  // —— Cover page ——
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Run Report", margin, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  y = 110;
  doc.text(`Run ID: ${run.id}`, margin, y);
  y += lineHeight + 4;
  if (run.codename) {
    doc.text(`Codename: ${run.codename}`, margin, y);
    y += lineHeight + 4;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`Status: ${run.status}`, margin, y);
  y += lineHeight + 4;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date(run.updated_at).toLocaleString()}`, margin, y);
  y += lineHeight + 8;
  doc.setFontSize(11);
  const outcomeLines = doc.splitTextToSize(outcome, width);
  outcomeLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += lineHeight;
  });
  y = pageHeight - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HyperShift — Agent-powered pipeline report", margin, y);

  // —— Page 2: Executive summary + Pipeline ——
  doc.addPage();
  y = margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.setFont("helvetica", "bold");
  addText("Executive summary", { size: 14 });
  y += 4;
  doc.setFont("helvetica", "normal");
  let execSummary = `Run ${run.id}${run.codename ? ` (${run.codename})` : ""} — ${run.status}. `;
  execSummary += `User intent: ${intent.slice(0, 140)}${intent.length > 140 ? "…" : ""}. `;
  execSummary += outcome;
  addText(execSummary);
  const finOpsCost =
    run.finops_output &&
    typeof run.finops_output === "object" &&
    "estimatedMonthlyCost" in run.finops_output
      ? ((
          run.finops_output as {
            estimatedMonthlyCost?: number;
            currency?: string;
          }
        ).estimatedMonthlyCost ?? 0)
      : 0;
  const finOpsCur =
    run.finops_output &&
    typeof run.finops_output === "object" &&
    "currency" in run.finops_output
      ? ((run.finops_output as { currency?: string }).currency ?? "USD")
      : "USD";
  const sentinelPass =
    run.sentinel_output &&
    typeof run.sentinel_output === "object" &&
    "veto" in run.sentinel_output
      ? !(run.sentinel_output as { veto?: boolean }).veto
      : null;
  const sreRollback =
    run.sre_output &&
    typeof run.sre_output === "object" &&
    "rollbackAction" in run.sre_output
      ? ((run.sre_output as { rollbackAction?: string }).rollbackAction ?? "—")
      : "—";
  addText(
    `Key metrics: FinOps ${finOpsCur} ${finOpsCost}/mo; Sentinel ${sentinelPass === null ? "—" : sentinelPass ? "pass" : "block"}; SRE rollback: ${sreRollback}; Duration ${durationSec}s; Agents executed: ${agentsExecuted}.`,
  );
  y += 14;

  // —— Pipeline (per-agent status + one bullet key output) ——
  doc.setFont("helvetica", "bold");
  addText("Pipeline", { size: 12 });
  y += 6;
  doc.setFont("helvetica", "normal");
  for (let step = 1; step <= 5; step++) {
    const name = AGENT_NAMES[step] ?? `Step ${step}`;
    const status = stepStatusLabel(run, step);
    const bullet = oneBulletForStep(step, run);
    addText(`${name}: ${status} — ${bullet}`);
  }
  y += 12;

  // —— Outputs / reports (condensed) ——
  doc.setFont("helvetica", "bold");
  addText("Outputs / reports", { size: 12 });
  y += 6;

  doc.setFont("helvetica", "bold");
  addText("1. Blueprint (Architect)", { size: 10 });
  doc.setFont("helvetica", "normal");
  if (run.architect_output && typeof run.architect_output === "object") {
    const a = run.architect_output as {
      appPlan?: { name?: string }[];
      appName?: string;
    };
    const stack = a.appPlan?.[0]?.name ?? "—";
    const appName = "appName" in a ? String(a.appName) : "—";
    addText(`Stack: ${stack}. App name: ${appName}.`);
  } else addText("—");
  y += 6;

  doc.setFont("helvetica", "bold");
  addText("2. Build plan (Builder)", { size: 10 });
  doc.setFont("helvetica", "normal");
  if (run.builder_output != null) {
    formatOutputSection(run.builder_output)
      .slice(0, 5)
      .forEach((line) => addText(line));
  } else addText("—");
  y += 6;

  doc.setFont("helvetica", "bold");
  addText("3. Security report (Sentinel)", { size: 10 });
  doc.setFont("helvetica", "normal");
  if (run.sentinel_output && typeof run.sentinel_output === "object") {
    const s = run.sentinel_output as {
      veto?: boolean;
      findings?: { title?: string; severity?: string }[];
    };
    addText(s.veto ? "Blocked." : "Passed.");
    if (Array.isArray(s.findings) && s.findings.length > 0) {
      s.findings
        .slice(0, 3)
        .forEach((f) => addText(`• ${f.severity ?? "—"}: ${f.title ?? "—"}`));
    }
  } else addText("—");
  y += 6;

  doc.setFont("helvetica", "bold");
  addText("4. SRE status", { size: 10 });
  doc.setFont("helvetica", "normal");
  if (run.sre_output && typeof run.sre_output === "object") {
    const s = run.sre_output as { rollbackAction?: string };
    addText(`Rollback: ${s.rollbackAction ?? "—"}`);
  } else addText("—");
  y += 6;

  doc.setFont("helvetica", "bold");
  addText("5. FinOps report", { size: 10 });
  doc.setFont("helvetica", "normal");
  if (run.finops_output && typeof run.finops_output === "object") {
    const f = run.finops_output as {
      estimatedMonthlyCost?: number;
      currency?: string;
    };
    addText(
      `Estimated cost: ${f.currency ?? "USD"} ${f.estimatedMonthlyCost ?? 0}/mo`,
    );
  } else addText("—");
  y += 14;

  // —— Appendix: Full audit log ——
  doc.setFont("helvetica", "bold");
  addText("Appendix A — Full audit log", { size: 12 });
  y += 6;
  const auditCap = 100;
  const auditLogs = logs.slice(0, auditCap);
  if (logs.length > auditCap)
    addText(`(First ${auditCap} entries of ${logs.length}.)`);
  doc.setFont("helvetica", "normal");
  for (const entry of auditLogs) {
    newPageIfNeeded(lineHeight * 2);
    addText(`${entry.action} — ${new Date(entry.created_at).toISOString()}`);
    if (entry.details != null && typeof entry.details === "object") {
      const detailStr = JSON.stringify(entry.details);
      if (detailStr.length <= 120) addText(detailStr);
      else addText(detailStr.slice(0, 120) + "…");
    }
  }
  y += 12;

  // —— Appendix: Receipt (cryptographic) ——
  doc.setFont("helvetica", "bold");
  addText("Appendix B — Receipt (verification)", { size: 12 });
  y += 6;
  doc.setFont("helvetica", "normal");
  addText(`Algorithm: ${RECEIPT_ALGORITHM}`);
  addText(`Timestamp: ${receiptTimestamp}`);
  addText(`Hash: ${receiptHash}`);
  addText(
    "Verification: Recompute hash of canonical run + audit log (same field order as in this export) and compare to Hash above.",
  );
  addText(
    "Audit log is append-only; the hash covers the full canonical run and audit content.",
  );

  // —— Headers/footers on all pages (except cover) ——
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("HyperShift — Run Report", margin, 14);
    doc.text(
      `Run ID: ${run.id}`,
      margin + width - doc.getTextWidth(`Run ID: ${run.id}`),
      14,
    );
    doc.text(`Page ${p} of ${totalPages}`, margin, pageHeight - 10);
    doc.text(
      run.id,
      margin + width - doc.getTextWidth(run.id),
      pageHeight - 10,
    );
  }

  doc.save(`run-${run.id}.pdf`);
}
