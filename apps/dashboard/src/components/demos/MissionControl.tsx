// UI THEME LOCKED

"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HolographicGlobe } from "@/components/visualizations/HolographicGlobe";
import { NeuralNetwork } from "@/components/visualizations/NeuralNetwork";
import { useAgentOrchestrator } from "@/hooks/useAgentOrchestrator";
import { getAgentLocationsForRun } from "@/utils/agents";
import type { LogEntry } from "@/types";
import { Loader2, Play, RotateCw, Zap, ShieldAlert } from "lucide-react";

type ViewMode = "globe" | "network";

interface MissionControlProps {
  title?: string;
  titleIcon?: ReactNode;
  description?: string;
  demos?: ReactNode;
  children?: ReactNode;
}

export function MissionControl({
  title = "Mission control",
  titleIcon,
  description,
  demos,
}: MissionControlProps) {
  const [prompt, setPrompt] = useState(
    "Deploy a simple Next.js landing page to local environment",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("globe");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const {
    agentStates,
    logs,
    connections,
    activeCities,
    isConnected,
    connectionState,
    resetKey,
    globalStatus,
    isRunning,
    startMissionWorkflow,
    resetAll,
  } = useAgentOrchestrator();

  // Track workflow completion for the current debug run
  useEffect(() => {
    if (!currentRunId || finishedAt !== null) return;
    const completed = logs.some(
      (log) =>
        log.agent === "finops" &&
        log.message.includes(`Workflow complete for run ${currentRunId}`),
    );
    if (completed) {
      setFinishedAt(Date.now());
    }
  }, [logs, currentRunId, finishedAt]);

  const deployTimeLabel = useMemo(() => {
    if (!startedAt) return "—";
    const end = finishedAt ?? Date.now();
    const seconds = (end - startedAt) / 1000;
    return `${seconds.toFixed(1)}s`;
  }, [startedAt, finishedAt]);

  const activeAgentsCount = useMemo(() => {
    return Object.values(agentStates).filter((state) => state !== "idle")
      .length;
  }, [agentStates]);

  const securityScoreLabel = useMemo(() => {
    if (agentStates.sentinel === "complete") return "92/100";
    if (agentStates.sentinel === "active") return "Running…";
    return "—";
  }, [agentStates.sentinel]);

  const estimatedCostLabel = useMemo(() => {
    if (agentStates.finops === "complete" || finishedAt) return "$450 / mo";
    if (agentStates.finops === "active") return "Estimating…";
    return "—";
  }, [agentStates.finops, finishedAt]);

  const handleDeploy = async () => {
    if (isRunning) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;
    resetAll();
    setCurrentRunId(null);
    setStartedAt(Date.now());
    setFinishedAt(null);
    const runId = await startMissionWorkflow(trimmed);
    setCurrentRunId(runId);
  };

  const handleReset = () => {
    setPrompt("Deploy a simple Next.js landing page to local environment");
    setCurrentRunId(null);
    setStartedAt(null);
    setFinishedAt(null);
    resetAll();
  };

  const latestLogs: LogEntry[] = useMemo(() => logs.slice(-40), [logs]);
  const agentLocations = useMemo(
    () => (currentRunId ? getAgentLocationsForRun(currentRunId) : undefined),
    [currentRunId],
  );

  return (
    <Card className="border-2 border-indigo-500/40 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 shadow-xl">
      <CardHeader className="space-y-3 border-b border-indigo-500/30 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {titleIcon}
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                {title}
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (connectionState === "connected"
                        ? "bg-emerald-400"
                        : connectionState === "reconnecting" ||
                            connectionState === "connecting"
                          ? "bg-amber-400"
                          : "bg-slate-500")
                    }
                  />
                  <span className="text-slate-200">
                    {connectionState === "connected"
                      ? "Realtime link"
                      : connectionState === "reconnecting"
                        ? "Reconnecting…"
                        : connectionState === "connecting"
                          ? "Connecting…"
                          : "Offline"}
                  </span>
                </span>
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]" +
                    (globalStatus === "RUNNING"
                      ? " border-sky-500/60 bg-sky-500/10 text-sky-200"
                      : globalStatus === "BLOCKED"
                        ? " border-red-500/60 bg-red-500/10 text-red-200"
                        : globalStatus === "COMPLETE"
                          ? " border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                          : " border-slate-600 bg-slate-900/80 text-slate-200")
                  }
                >
                  {globalStatus}
                </span>
              </CardTitle>
              {description ? (
                <p className="mt-1 text-xs text-slate-300/80">{description}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {demos}
            {/* quick sample prompts */}
            <Button
              variant="outline"
              size="xs"
              className="gap-1 border-dashed border-indigo-400/40 text-[11px] text-indigo-200"
              disabled={isRunning}
              type="button"
              onClick={() =>
                setPrompt(
                  "Deploy a multi-region API with blue/green rollout and monitoring",
                )
              }
            >
              <Zap className="h-3 w-3" />
              Sample: Happy path
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="gap-1 border-dashed border-amber-400/40 text-[11px] text-amber-100"
              disabled={isRunning}
              type="button"
              onClick={() =>
                setPrompt(
                  "Deploy app with sabotage demo; inject failing health checks for SRE",
                )
              }
            >
              <ShieldAlert className="h-3 w-3" />
              Sample: Sabotage
            </Button>
          </div>

          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
            className="h-8"
          >
            <TabsList className="h-8 bg-slate-900/80 text-[11px]">
              <TabsTrigger value="globe" className="px-3">
                Globe
              </TabsTrigger>
              <TabsTrigger value="network" className="px-3">
                Network
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Prompt + controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300/80">
              <span>Deployment prompt</span>
              {currentRunId ? (
                <span className="font-mono text-[10px] text-slate-400">
                  {currentRunId}
                </span>
              ) : null}
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none border-indigo-500/50 bg-slate-950/80 text-sm"
              placeholder="Describe what you want to deploy..."
              disabled={isRunning}
            />
          </div>
          <div className="flex w-full flex-col gap-2 md:w-40">
            <Button
              type="button"
              onClick={handleDeploy}
              className="w-full gap-2 bg-indigo-500 text-xs font-semibold"
              disabled={isRunning}
            >
              <Play className="h-3.5 w-3.5" />
              Deploy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="w-full gap-2 border-slate-600 text-xs text-slate-200"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Deploy time"
            value={deployTimeLabel}
            hint={finishedAt ? "Last debug run" : "Since start"}
          />
          <MetricCard
            label="Security score"
            value={securityScoreLabel}
            hint="Sentinel scan"
          />
          <MetricCard
            label="Estimated cost"
            value={estimatedCostLabel}
            hint="FinOps model"
          />
          <MetricCard
            label="Active agents"
            value={activeAgentsCount.toString()}
            hint="Non-idle agents"
          />
        </div>

        {/* Visualization + terminal */}
        <div className="mt-2 grid gap-4 lg:h-[600px] lg:grid-cols-[minmax(0,1.6fr),minmax(0,1.1fr)]">
          <div className="flex h-full flex-col gap-3">
            <motion.div
              key={viewMode}
              className="h-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {viewMode === "globe" ? (
                <HolographicGlobe
                  key={`globe-${resetKey}`}
                  agentStates={agentStates}
                  activeCities={activeCities}
                  connections={connections}
                  agentLocations={agentLocations}
                />
              ) : (
                <NeuralNetwork
                  key={`network-${resetKey}`}
                  agentStates={agentStates}
                  connections={connections}
                  isRunning={isRunning}
                  agentLocations={agentLocations}
                />
              )}
            </motion.div>
          </div>

          {/* Terminal */}
          <Card className="flex h-full flex-col border-slate-700/70 bg-slate-950/90">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">Agent terminal</CardTitle>
                <p className="text-[11px] text-slate-400">
                  Live logs from architect, builder, sentinel, SRE, and FinOps.
                </p>
              </div>
              <Badge
                variant="outline"
                className="flex items-center gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300"
              >
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Streaming
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                    Paused
                  </span>
                )}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <div className="h-full overflow-auto bg-gradient-to-b from-slate-950 to-slate-900 px-3 py-2 font-mono text-[11px] text-slate-100">
                {latestLogs.length === 0 ? (
                  <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Waiting for events…</span>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {latestLogs.map((log, idx) => (
                      <motion.div
                        key={`${log.timestamp}-${log.agent}-${idx}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex items-start gap-2 py-0.5"
                      >
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-600" />
                        <div className="flex-1 space-y-0.5">
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
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <motion.div
      className="rounded-lg border border-indigo-500/30 bg-slate-950/70 px-3 py-2 text-xs text-slate-100"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-300/90">{label}</span>
        {hint ? (
          <span className="text-[9px] text-slate-500">{hint}</span>
        ) : null}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </motion.div>
  );
}
