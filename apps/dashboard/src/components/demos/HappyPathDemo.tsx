// UI THEME LOCKED

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentOrchestrator } from "@/hooks/useAgentOrchestrator";
import { projectTemplates, agentOrder, getAgentById } from "@/utils/agents";
import { Zap, ExternalLink, X, RotateCw } from "lucide-react";
import type { AgentStatus, TemplateId } from "@/types";

interface HappyPathDemoProps {
  disabled?: boolean;
  onClick?: () => void;
}

type ScenarioStatus = "idle" | "running" | "success" | "blocked";

function agentStatusLabel(s: AgentStatus): string {
  if (s === "active") return "Running";
  if (s === "complete") return "Done";
  if (s === "blocked" || s === "failed") return "Blocked";
  return "Idle";
}

function agentStatusClasses(s: AgentStatus): string {
  if (s === "active") return "border-sky-500/60 bg-sky-500/10 text-sky-200";
  if (s === "complete")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (s === "blocked" || s === "failed")
    return "border-red-500/60 bg-red-500/10 text-red-100";
  return "border-slate-600 bg-slate-900/80 text-slate-200";
}

export function HappyPathDemo({ disabled, onClick }: HappyPathDemoProps) {
  const [status, setStatus] = useState<ScenarioStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  const { agentStates, logs, deployment, isRunning, runHappyPath, resetAll } =
    useAgentOrchestrator();

  useEffect(() => {
    if (!deployment) {
      setShowDeploymentModal(false);
      return;
    }
  }, [deployment]);

  useEffect(() => {
    if (!runId || status !== "running") return;
    const completed = logs.some((log) =>
      log.message.includes(`Workflow complete for run ${runId}`),
    );
    if (completed) {
      setStatus("success");
      setShowDeploymentModal(true);
    }
  }, [logs, runId, status]);

  useEffect(() => {
    if (deployment && status === "running") {
      setStatus("success");
      setShowDeploymentModal(true);
    }
  }, [deployment, status]);

  const handleSelectTemplate = async (templateId: TemplateId) => {
    if (disabled || isRunning) return;
    resetAll();
    setStatus("running");
    setShowDeploymentModal(false);
    const id = await runHappyPath(templateId);
    setRunId(id);
    onClick?.();
  };

  const handleReset = () => {
    resetAll();
    setRunId(null);
    setStatus("idle");
    setShowDeploymentModal(false);
  };

  const activeAgents = useMemo(
    () => Object.entries(agentStates).filter(([, s]) => s !== "idle").length,
    [agentStates],
  );

  const terminalLogs = useMemo(() => logs.slice(-40), [logs]);

  const banner = (() => {
    if (status === "success") {
      return (
        <div className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-100">
          <span className="font-semibold">SUCCESS:</span> All agents completed
          the happy path demo run.
        </div>
      );
    }
    if (status === "blocked") {
      return (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">
          <span className="font-semibold">BLOCKED:</span> Scenario was
          intentionally stopped for review.
        </div>
      );
    }
    return null;
  })();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Card className="flex flex-1 flex-col gap-3 rounded-md border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-100">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-0 pb-2">
            <div className="flex items-center gap-2">
              <Badge className="h-5 rounded-full bg-sky-500/90 px-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                Happy path
              </Badge>
              <div className="flex flex-col">
                <CardTitle className="text-xs font-semibold text-slate-100">
                  Select a template and run the full pipeline.
                </CardTitle>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Architect → Builder → Sentinel → SRE → FinOps. Clean run with
                  no sabotage.
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-500">
              Active agents: <span className="font-mono">{activeAgents}</span>
            </span>
          </CardHeader>

          <CardContent className="space-y-3 px-0 pt-0">
            {/* Template cards */}
            <div className="grid gap-2 sm:grid-cols-2">
              {projectTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled || isRunning}
                  onClick={() => handleSelectTemplate(t.id as TemplateId)}
                  className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-left transition-colors hover:border-slate-600 hover:bg-slate-900/80 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-[11px] font-semibold text-slate-100">
                      {t.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Pipeline progress (agentOrder + agentStates) */}
            <div className="rounded-md border border-slate-700/70 bg-slate-950/90 px-3 py-2">
              <span className="text-[11px] font-medium text-slate-100">
                Pipeline progress
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {agentOrder.map((agentId) => {
                  const s = agentStates[agentId];
                  const label = agentStatusLabel(s);
                  return (
                    <span
                      key={agentId}
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] " +
                        agentStatusClasses(s)
                      }
                    >
                      {getAgentById(agentId)?.name ?? agentId}: {label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="gap-1.5 border-slate-600 text-slate-200"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>

            {banner}

            {/* Terminal logs */}
            <div className="rounded-md border border-slate-700/70 bg-slate-950/90">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] font-medium text-slate-100">
                  Deploy logs
                </span>
                <Badge className="flex items-center gap-1 border-emerald-500/40 bg-emerald-500/10 text-[9px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live stream
                </Badge>
              </div>
              <div className="h-28 overflow-auto bg-gradient-to-b from-slate-950 to-slate-900 px-3 py-2 font-mono text-[11px] text-slate-100">
                {terminalLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-600 border-t-transparent" />
                    <span>Waiting for events…</span>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {terminalLogs.map((log, idx) => (
                      <motion.div
                        key={`${log.timestamp}-${log.agent}-${idx}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex items-start gap-2 py-0.5"
                      >
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-200">
                              {log.agent}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-[9px] uppercase text-slate-500">
                              {log.level}
                            </span>
                            {log.location ? (
                              <span className="text-[9px] text-slate-500">
                                {log.location}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-slate-100">
                            {log.message}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Deployment preview modal (minimal, existing Card/Button styling) */}
      <AnimatePresence>
        {showDeploymentModal && deployment && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              aria-hidden
              onClick={() => setShowDeploymentModal(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-100">
                    Deployment ready
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-100"
                    onClick={() => setShowDeploymentModal(false)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">Live URL</span>
                    <p
                      className="break-all font-mono text-sm text-slate-100"
                      title={deployment.url}
                    >
                      {deployment.url}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1 gap-2 bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600"
                      onClick={() =>
                        window.open(
                          deployment.url,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit live site
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-600 text-slate-200"
                      onClick={() => setShowDeploymentModal(false)}
                    >
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
