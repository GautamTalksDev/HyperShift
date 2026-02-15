// UI THEME LOCKED

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentOrchestrator } from "@/hooks/useAgentOrchestrator";
import { attackScenarios } from "@/utils/agents";
import { Loader2, RotateCw, ShieldAlert } from "lucide-react";
import type { AttackType, LogEntry } from "@/types";

// Display order for the 4 attack scenarios (sabotage-focused first)
const SABOTAGE_SCENARIO_ORDER: AttackType[] = [
  "sabotage",
  "timeout",
  "rollback",
  "happy_path",
];

interface SabotageDemoProps {
  disabled?: boolean;
  onClick?: () => void;
}

type ScenarioStatus = "idle" | "scanning" | "blocked";

export function SabotageDemo({ disabled, onClick }: SabotageDemoProps) {
  const [status, setStatus] = useState<ScenarioStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);

  const { agentStates, logs, isRunning, runSabotage, resetAll } =
    useAgentOrchestrator();

  useEffect(() => {
    if (status !== "scanning") return;
    if (agentStates.sentinel === "blocked") {
      setStatus("blocked");
      return;
    }
    if (
      runId &&
      logs.some((log) =>
        log.message.includes(`Workflow complete for run ${runId}`),
      )
    ) {
      setStatus("blocked");
    }
  }, [agentStates.sentinel, logs, runId, status]);

  const handleRun = async (attackType: AttackType) => {
    if (disabled || isRunning) return;
    resetAll();
    setRunId(null);
    setStatus("scanning");
    const id = await runSabotage(attackType);
    setRunId(id);
    onClick?.();
  };

  const handleReset = () => {
    resetAll();
    setRunId(null);
    setStatus("idle");
  };

  const activeAgents = useMemo(
    () => Object.entries(agentStates).filter(([, s]) => s !== "idle").length,
    [agentStates],
  );

  const banner = (() => {
    if (status === "blocked") {
      return (
        <div className="mt-2 rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-100">
          <span className="font-semibold">BLOCKED:</span> SRE and Sentinel
          caught the sabotage and prevented the deployment from completing.
        </div>
      );
    }
    return null;
  })();

  const statusLabel = (() => {
    if (status === "scanning") return "Scanning";
    if (status === "blocked") return "Blocked";
    return "Idle";
  })();

  const statusClasses =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] " +
    (status === "scanning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : status === "blocked"
        ? "border-red-500/60 bg-red-500/10 text-red-100"
        : "border-slate-600 bg-slate-900/80 text-slate-200");

  const terminalLogs: LogEntry[] = useMemo(() => logs.slice(-40), [logs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Card className="flex flex-1 flex-col gap-2 rounded-md border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-100">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 px-0 pb-2">
          <div className="flex items-center gap-2">
            <Badge className="h-5 rounded-full bg-red-500/90 px-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Sabotage demo
            </Badge>
            <div className="flex flex-col">
              <CardTitle className="text-xs font-semibold text-slate-100">
                Inject failure and observe SRE + Sentinel response.
              </CardTitle>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Simulates a bad deploy where failing health checks trigger a
                rollback recommendation.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-slate-500">
              Active agents: <span className="font-mono">{activeAgents}</span>
            </span>
            <span className={statusClasses}>{statusLabel}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 px-0 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {SABOTAGE_SCENARIO_ORDER.map((attackType) => {
              const scenario = attackScenarios[attackType];
              return (
                <Button
                  key={scenario.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || isRunning || status === "scanning"}
                  onClick={() => handleRun(attackType)}
                  className="gap-1.5 border-red-500/60 text-left text-red-100"
                >
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{scenario.label}</span>
                </Button>
              );
            })}
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

          <div className="mt-2 rounded-md border border-slate-700/70 bg-slate-950/90">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] font-medium text-slate-100">
                Sabotage logs
              </span>
              <Badge className="flex items-center gap-1 border-emerald-500/40 bg-emerald-500/10 text-[9px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live stream
              </Badge>
            </div>
            <div className="h-32 overflow-auto bg-gradient-to-b from-slate-950 to-slate-900 px-3 py-2 font-mono text-[11px] text-slate-100">
              {terminalLogs.length === 0 ? (
                <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Waiting for sabotage events…</span>
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
  );
}
