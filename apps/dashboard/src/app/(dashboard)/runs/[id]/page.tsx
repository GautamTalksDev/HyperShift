"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JsonViewer } from "@/components/json-viewer";
import { useAuth } from "@/components/supabase-auth-provider";
import {
  getRun,
  getRunLogs,
  replayRun,
  executeRollback,
  startRunById,
  approveRun,
  rejectRun,
  submitRunFeedback,
  type RunDetail,
  type AuditLogEntry,
} from "@/lib/orchestrator";
import { canApproveReject } from "@/lib/auth";
import {
  runToAgentStates,
  runToConnections,
  getThinkingLine,
  getStepExplanation,
} from "@/lib/run-state";
import {
  playStepSound,
  notifyRunOutcome,
  getSettings,
  playAgentCompletedSound,
  playAgentBlockedSound,
  playMissionCompleteSting,
  playMissionFailedSting,
} from "@/lib/settings";
import { reportRunOutcome } from "@/lib/observability";
import {
  ArrowLeft,
  Layout,
  Hammer,
  Shield,
  Activity,
  DollarSign,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Share2,
  RotateCw,
  Undo2,
  FileDown,
  Focus,
  ListChecks,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { exportRunToPdf } from "@/lib/export-pdf";
import { SettingsDialog } from "@/components/settings-dialog";
import { HolographicGlobe } from "@/components/visualizations/HolographicGlobe";
import { NeuralNetwork } from "@/components/visualizations/NeuralNetwork";
import { agentOrder, getAgentLocationsForRun } from "@/utils/agents";
import { LaunchOverlay } from "@/components/LaunchOverlay";
import { MissionParticles } from "@/components/MissionParticles";
import { motion } from "framer-motion";

const AGENTS = [
  {
    step: 1,
    name: "Architect",
    icon: Layout,
    outputKey: "architect_output" as const,
    label: "Blueprint",
  },
  {
    step: 2,
    name: "Builder",
    icon: Hammer,
    outputKey: "builder_output" as const,
    label: "BuildPlan",
  },
  {
    step: 3,
    name: "Sentinel",
    icon: Shield,
    outputKey: "sentinel_output" as const,
    label: "SecurityReport",
  },
  {
    step: 4,
    name: "SRE",
    icon: Activity,
    outputKey: "sre_output" as const,
    label: "SREStatus",
  },
  {
    step: 5,
    name: "FinOps",
    icon: DollarSign,
    outputKey: "finops_output" as const,
    label: "FinOpsReport",
  },
] as const;

type StepStatus = "PENDING" | "RUNNING" | "DONE" | "BLOCKED" | "FAILED";

function stepStatus(step: number, run: RunDetail): StepStatus {
  const { status, current_step } = run;
  if (status === "completed") return "DONE";
  if (status === "blocked") {
    if (step < 3) return "DONE";
    if (step === 3) return "BLOCKED";
    return "PENDING";
  }
  if (status === "failed") {
    if (step < current_step) return "DONE";
    if (step === current_step) return "FAILED";
    return "PENDING";
  }
  if (status === "running") {
    if (step < current_step) return "DONE";
    if (step === current_step) return "RUNNING";
    return "PENDING";
  }
  return "PENDING";
}

function sreRecommendsRollback(run: RunDetail): boolean {
  const out = run.sre_output;
  if (!out || typeof out !== "object" || !("rollbackAction" in out))
    return false;
  const a = (out as { rollbackAction?: string }).rollbackAction;
  return a === "recommended" || a === "required";
}

export default function RunPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, workspaceId, role } = useAuth();
  const auth = workspaceId
    ? { workspaceId, userId: user?.email ?? undefined }
    : undefined;
  const id = params.id as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const showLaunch =
    searchParams.get("launch") === "1" && !notFound && (loading || !!run);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdatedOutputKey, setLastUpdatedOutputKey] = useState<
    keyof RunDetail | null
  >(null);
  const [assemble, setAssemble] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedPendingRef = useRef<string | null>(null);
  const prevStatusRef = useRef<RunDetail["status"] | null>(null);
  const prevOutputsRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    setReduceMotion(getSettings().reducedMotion);
  }, []);

  // Start pipeline when user enters run screen and run is pending (when no launch overlay: start immediately; when launch=1: start in onDismiss)
  useEffect(() => {
    if (
      !run ||
      run.status !== "pending" ||
      showLaunch ||
      startedPendingRef.current === run.id
    )
      return;
    startedPendingRef.current = run.id;
    startRunById(run.id, auth).catch(() => {
      startedPendingRef.current = null;
    });
  }, [run?.id, run?.status, showLaunch, auth?.workspaceId]);

  const fetchRun = useCallback(async () => {
    try {
      setFetchError(null);
      const r = await getRun(id, auth);
      if (!r) {
        setNotFound(true);
        setRun(null);
        return;
      }
      setRun(r);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load run");
    }
  }, [id, auth?.workspaceId]);

  const fetchLogs = useCallback(async () => {
    try {
      const list = await getRunLogs(id, auth);
      setLogs(list);
    } catch {
      // non-fatal; keep previous logs
    }
  }, [id, auth?.workspaceId]);

  useEffect(() => {
    let cancelled = false;
    setFetchError(null);
    Promise.all([getRun(id, auth), getRunLogs(id, auth)])
      .then(([r, list]) => {
        if (cancelled) return;
        if (!r) setNotFound(true);
        else setRun(r);
        setLogs(list);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(false);
          setFetchError("Failed to load run. Check connection and retry.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, auth?.workspaceId]);

  // "Just updated" highlight + agent-completed sound: detect when an agent output appears/changes
  useEffect(() => {
    if (!run) return;
    const keys: (keyof RunDetail)[] = [
      "architect_output",
      "builder_output",
      "sentinel_output",
      "sre_output",
      "finops_output",
    ];
    for (const key of keys) {
      const v = run[key];
      if (v != null && v !== prevOutputsRef.current[key]) {
        prevOutputsRef.current[key] = v;
        setLastUpdatedOutputKey(key);
        playAgentCompletedSound();
        const t = setTimeout(() => setLastUpdatedOutputKey(null), 2200);
        return () => clearTimeout(t);
      }
    }
    prevOutputsRef.current = {
      architect_output: run.architect_output,
      builder_output: run.builder_output,
      sentinel_output: run.sentinel_output,
      sre_output: run.sre_output,
      finops_output: run.finops_output,
    };
  }, [
    run?.architect_output,
    run?.builder_output,
    run?.sentinel_output,
    run?.sre_output,
    run?.finops_output,
  ]);

  const isTerminal =
    run?.status === "completed" ||
    run?.status === "failed" ||
    run?.status === "blocked";
  const agentLocations = useMemo(
    () => (run ? getAgentLocationsForRun(run.id) : undefined),
    [run?.id],
  );

  // Play step sound, optional mission sting, notification, and observability when run becomes terminal (once per transition)
  useEffect(() => {
    if (!run) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = run.status;
    if (
      run.status !== "completed" &&
      run.status !== "failed" &&
      run.status !== "blocked"
    )
      return;
    if (prev === run.status) return; // already terminal, avoid re-firing
    if (run.status === "blocked") {
      playAgentBlockedSound();
    } else if (run.status === "completed") {
      playStepSound("complete");
      setTimeout(() => playMissionCompleteSting(), 180);
    } else {
      playStepSound("fail");
      setTimeout(() => playMissionFailedSting(), 150);
    }
    notifyRunOutcome(run.id, run.status);
    const durationMs =
      new Date(run.updated_at).getTime() - new Date(run.created_at).getTime();
    reportRunOutcome({
      run_id: run.id,
      status: run.status,
      duration_ms: durationMs,
    });
  }, [run?.id, run?.status, run?.created_at, run?.updated_at]);

  // Real-time feel: poll frequently so user sees agents working (500ms when pending/just started, 700ms while running)
  useEffect(() => {
    if (!run || isTerminal) return;
    const intervalMs =
      run.status === "pending" ? 500 : run.status === "running" ? 700 : 2000;
    const t = setInterval(() => {
      fetchRun();
      fetchLogs();
    }, intervalMs);
    return () => clearInterval(t);
  }, [run?.id, run?.status, isTerminal, fetchRun, fetchLogs]);

  const handleReplay = async () => {
    if (!run || replaying) return;
    setReplaying(true);
    try {
      const { run_id } = await replayRun(run.id, auth);
      router.push(`/runs/${run_id}`);
    } finally {
      setReplaying(false);
    }
  };
  const handleRollback = async () => {
    if (!run || rollingBack) return;
    if (
      !confirm(
        "Execute rollback? This will be recorded in the audit log. (Mock: no infra change.)",
      )
    )
      return;
    setRollingBack(true);
    try {
      await executeRollback(run.id, auth);
      await fetchLogs();
    } finally {
      setRollingBack(false);
    }
  };
  const isAwaitingApproval =
    run?.status === "blocked" &&
    !run?.rejected_at &&
    !run?.approved_at &&
    (run?.require_approval === true ||
      (run?.error?.toLowerCase().includes("awaiting approval") ?? false));
  const showApprovalActions =
    isAwaitingApproval &&
    canApproveReject(
      role as "viewer" | "operator" | "admin" | undefined,
    );
  const handleApprove = async () => {
    if (!run || approving) return;
    setApproving(true);
    try {
      await approveRun(run.id, auth);
      await fetchRun();
      await fetchLogs();
    } finally {
      setApproving(false);
    }
  };
  const handleReject = async () => {
    if (!run || rejecting) return;
    if (!confirm("Reject production deploy? The run will stay blocked."))
      return;
    setRejecting(true);
    try {
      await rejectRun(run.id, auth);
      await fetchRun();
      await fetchLogs();
    } finally {
      setRejecting(false);
    }
  };
  const handleFeedback = async (
    useful?: boolean,
    deploy_succeeded?: boolean,
  ) => {
    if (
      !run ||
      feedbackSubmitting ||
      (useful === undefined && deploy_succeeded === undefined)
    )
      return;
    setFeedbackSubmitting(true);
    try {
      await submitRunFeedback(run.id, { useful, deploy_succeeded }, auth);
      await fetchRun();
    } finally {
      setFeedbackSubmitting(false);
    }
  };
  const handleShare = useCallback(() => {
    setShareError(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard
      .writeText(url)
      .then(() => {})
      .catch(() => setShareError("Could not copy link"));
  }, []);

  const handleExportPdf = async () => {
    if (!run || exportingPdf) return;
    setExportingPdf(true);
    setExportError(null);
    try {
      await exportRunToPdf(run, logs);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  // Mission view from first frame: show layout with skeletons when loading (we have run id from URL)
  const showMissionSkeletons = loading && !run && !notFound && !fetchError;

  if (notFound || (!loading && !run)) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="mt-8 rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Run not found</p>
            <p className="mt-1 text-sm text-muted-foreground">ID: {id}</p>
          </div>
        </div>
      </main>
    );
  }

  // Fetch failed: show mission-style layout with error banner and retry
  if (fetchError && !run) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-sm text-destructive font-medium">{fetchError}</p>
            <Button
              onClick={() => {
                setLoading(true);
                setFetchError(null);
                Promise.all([getRun(id, auth), getRunLogs(id, auth)])
                  .then(([r, list]) => {
                    if (!r) setNotFound(true);
                    else setRun(r);
                    setLogs(list);
                  })
                  .catch(() =>
                    setFetchError(
                      "Failed to load run. Check connection and retry.",
                    ),
                  )
                  .finally(() => setLoading(false));
              }}
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const isInitializing = showMissionSkeletons;
  const missionRun = run ?? null;
  const pollLabel =
    missionRun?.status === "pending"
      ? "Starting…"
      : missionRun?.status === "running"
        ? "Updating every 0.7s"
        : "Updating every 2s";

  const assembleDuration = reduceMotion ? 0.01 : 0.5;
  const assembleStagger = reduceMotion ? 0 : 0.08;

  return (
    <>
      {showLaunch && (
        <LaunchOverlay
          runId={id}
          onDismiss={() => {
            setAssemble(true);
            if (
              run?.status === "pending" &&
              startedPendingRef.current !== run.id
            ) {
              startedPendingRef.current = run.id;
              startRunById(id).catch(() => {
                startedPendingRef.current = null;
              });
            }
          }}
        />
      )}
      <main
        className="relative min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 py-6 sm:px-6 sm:py-10"
        role="main"
        aria-label="Mission run view"
      >
        {!focusMode && (
          <MissionParticles
            triggerKey={lastUpdatedOutputKey}
            active={!!missionRun}
          />
        )}
        <motion.div
          className="mx-auto max-w-6xl space-y-6 relative z-10"
          initial={assemble ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: assemble ? assembleDuration : 0 }}
        >
          <motion.header
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            initial={assemble ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: assembleDuration,
              delay: assemble ? assembleStagger * 0 : 0,
            }}
          >
            <div className="min-w-0">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden /> Dashboard
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1
                  className="font-mono text-lg sm:text-xl font-semibold truncate"
                  id="run-title"
                >
                  {missionRun?.id ?? id}
                </h1>
                {missionRun?.codename && (
                  <Badge variant="secondary" className="font-normal">
                    {missionRun.codename}
                  </Badge>
                )}
                {missionRun &&
                  Array.isArray(missionRun.tags) &&
                  missionRun.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {missionRun.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  )}
                {isInitializing && (
                  <span className="text-xs text-muted-foreground">
                    Initializing…
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground truncate">
                {missionRun?.user_intent?.description ??
                  (isInitializing ? "Loading…" : "No description")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {missionRun && !isTerminal && (
                <span
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {pollLabel}
                </span>
              )}
              {missionRun && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleShare}
                    title="Copy run URL"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                  {shareError && (
                    <span className="text-xs text-destructive">
                      {shareError}
                    </span>
                  )}
                  {missionRun.deployment_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        window.open(
                          missionRun.deployment_url!,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      title="Open live deployment"
                    >
                      <ExternalLink className="h-4 w-4" /> View deployment
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={exportingPdf}
                    onClick={handleExportPdf}
                    title="Export run summary and receipt as PDF"
                  >
                    <FileDown className="h-4 w-4" />{" "}
                    {exportingPdf ? "Exporting…" : "Export PDF"}
                  </Button>
                  {exportError && (
                    <span className="text-xs text-destructive">
                      {exportError}
                    </span>
                  )}
                  {showApprovalActions && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        disabled={approving}
                        onClick={handleApprove}
                        title="Approve production deploy"
                      >
                        <CheckCircle2 className="h-4 w-4" />{" "}
                        {approving ? "Approving…" : "Approve deploy"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        disabled={rejecting}
                        onClick={handleReject}
                        title="Reject production deploy"
                      >
                        <XCircle className="h-4 w-4" />{" "}
                        {rejecting ? "Rejecting…" : "Reject"}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={replaying}
                    onClick={handleReplay}
                    title="Start a new run with same intent"
                  >
                    <RotateCw className="h-4 w-4" />{" "}
                    {replaying ? "Starting…" : "Replay"}
                  </Button>
                  {missionRun && sreRecommendsRollback(missionRun) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      disabled={rollingBack}
                      onClick={handleRollback}
                      title="Execute rollback (recorded in audit log)"
                    >
                      <Undo2 className="h-4 w-4" />{" "}
                      {rollingBack ? "Executing…" : "Execute rollback"}
                    </Button>
                  )}
                  <Button
                    variant={focusMode ? "secondary" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setFocusMode((v) => !v)}
                    title={
                      focusMode
                        ? "Show 3D globe and network"
                        : "Hide 3D to focus on pipeline"
                    }
                  >
                    <Focus className="h-4 w-4" />{" "}
                    {focusMode ? "Show 3D" : "Focus mode"}
                  </Button>
                  {missionRun && isTerminal && !missionRun.feedback_at && (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      Was this useful?
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={feedbackSubmitting}
                        onClick={() => handleFeedback(true)}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={feedbackSubmitting}
                        onClick={() => handleFeedback(false)}
                      >
                        No
                      </Button>
                      {missionRun.deployment_url && (
                        <>
                          Deploy succeeded?
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={feedbackSubmitting}
                            onClick={() => handleFeedback(undefined, true)}
                          >
                            Yes
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={feedbackSubmitting}
                            onClick={() => handleFeedback(undefined, false)}
                          >
                            No
                          </Button>
                        </>
                      )}
                    </span>
                  )}
                </>
              )}
              <SettingsDialog />
              {missionRun && (
                <Badge
                  variant={runStatusVariant(missionRun.status)}
                  className="w-fit capitalize transition-all duration-300"
                >
                  {missionRun.status}
                </Badge>
              )}
            </div>
          </motion.header>

          {fetchError && missionRun && (
            <div
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {fetchError}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFetchError(null);
                  fetchRun();
                  fetchLogs();
                }}
                className="gap-1.5"
              >
                <RotateCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {showApprovalActions && missionRun && (
            <div
              className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4"
              role="alert"
              aria-live="assertive"
            >
              <div>
                <p className="font-medium text-foreground">
                  Awaiting approval for production deploy
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Approve to continue the pipeline (SRE → FinOps → deploy) or
                  reject to keep this run blocked.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  disabled={approving}
                  onClick={handleApprove}
                  title="Approve production deploy"
                >
                  <CheckCircle2 className="h-4 w-4" />{" "}
                  {approving ? "Approving…" : "Approve deploy"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={rejecting}
                  onClick={handleReject}
                  title="Reject production deploy"
                >
                  <XCircle className="h-4 w-4" />{" "}
                  {rejecting ? "Rejecting…" : "Reject"}
                </Button>
              </div>
            </div>
          )}

          {/* Mission: Globe hero (visible from first frame) */}
          {!focusMode && (
            <motion.section
              className="space-y-2"
              aria-label="World map and agent mesh"
              initial={assemble ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: assembleDuration,
                delay: assemble ? assembleStagger * 1 : 0,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-mono uppercase tracking-wider">
                  {missionRun?.status === "running"
                    ? "Pipeline live"
                    : missionRun
                      ? "Agent mesh online"
                      : "Initializing…"}
                </span>
                {missionRun && (
                  <span
                    className="font-mono tabular-nums"
                    aria-label="Mission elapsed time"
                  >
                    {new Date(missionRun.created_at).toLocaleTimeString(
                      undefined,
                      { hour: "2-digit", minute: "2-digit", second: "2-digit" },
                    )}
                    {missionRun.updated_at !== missionRun.created_at && (
                      <>
                        {" "}
                        →{" "}
                        {new Date(missionRun.updated_at).toLocaleTimeString(
                          undefined,
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          },
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
              <h2 className="sr-only">Globe and agent locations</h2>
              {isInitializing ? (
                <GlobeSkeleton />
              ) : missionRun ? (
                <Tabs defaultValue="globe" className="w-full">
                  <TabsList className="mb-2">
                    <TabsTrigger value="globe">Globe</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                  </TabsList>
                  <TabsContent value="globe" className="mt-0">
                    <div className="min-h-[50vh] sm:min-h-[55vh] h-[55vh] sm:h-[60vh] w-full overflow-hidden rounded-xl border border-sky-500/30 bg-card shadow-lg">
                      <HolographicGlobe
                        agentStates={runToAgentStates(missionRun)}
                        activeCities={agentOrder
                          .filter((id) => {
                            const s = runToAgentStates(missionRun)[id];
                            return s === "active" || s === "complete";
                          })
                          .map((id) => agentLocations![id].name)}
                        connections={runToConnections(missionRun)}
                        agentLocations={agentLocations}
                        fullHeight
                        currentStep={missionRun.current_step}
                        runStatus={missionRun.status}
                        runStartedAt={
                          missionRun.status === "running" ||
                          missionRun.status === "completed"
                            ? new Date(missionRun.created_at).getTime()
                            : undefined
                        }
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="network" className="mt-0">
                    <div className="min-h-[50vh] sm:min-h-[55vh] h-[55vh] sm:h-[60vh] w-full overflow-hidden rounded-xl border border-sky-500/30 bg-card shadow-lg">
                      <NeuralNetwork
                        agentStates={runToAgentStates(missionRun)}
                        connections={runToConnections(missionRun)}
                        isRunning={missionRun.status === "running"}
                        agentLocations={agentLocations}
                        fullHeight
                        currentStep={missionRun.current_step}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              ) : null}
            </motion.section>
          )}

          {/* Agent strip: Architect → Builder → Sentinel → SRE → FinOps with live status */}
          <motion.section
            className="rounded-xl border bg-card p-4 shadow-sm"
            aria-label="Agent pipeline"
            initial={assemble ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: assembleDuration,
              delay: assemble ? assembleStagger * 2 : 0,
            }}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline
            </h2>
            {isInitializing ? (
              <AgentStripSkeleton />
            ) : missionRun ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                {AGENTS.map((agentInfo, idx) => {
                  const status = stepStatus(agentInfo.step, missionRun);
                  const thinking = getThinkingLine(agentInfo.step, missionRun);
                  const explain = getStepExplanation(
                    agentInfo.step,
                    missionRun,
                  );
                  return (
                    <div
                      key={agentInfo.step}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <AgentStripItem
                        step={agentInfo.step}
                        name={agentInfo.name}
                        icon={agentInfo.icon}
                        status={status}
                        thinking={thinking}
                        explain={explain}
                      />
                      {idx < AGENTS.length - 1 && (
                        <span
                          className="hidden sm:inline text-muted-foreground"
                          aria-hidden
                        >
                          →
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </motion.section>

          {/* 5 agent cards (compact grid) */}
          {missionRun && (
            <section
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
              aria-label="Agent cards"
            >
              {AGENTS.map(({ step, name, icon: Icon }) => {
                const status = stepStatus(step, missionRun);
                const explain = getStepExplanation(step, missionRun);
                return (
                  <AgentCard
                    key={step}
                    step={step}
                    name={name}
                    Icon={Icon}
                    status={status}
                    explanation={
                      status === "BLOCKED" || status === "FAILED"
                        ? explain
                        : undefined
                    }
                  />
                );
              })}
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    Audit log
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Timeline of pipeline events (live while running).
                  </p>
                </div>
                <Dialog open={auditLogOpen} onOpenChange={setAuditLogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5 shrink-0"
                    >
                      <ListChecks className="h-4 w-4" /> View audit log
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-h-[85vh] max-w-2xl"
                    aria-describedby="audit-log-description"
                  >
                    <DialogHeader>
                      <DialogTitle>
                        Full audit log — {missionRun?.id ?? id}
                      </DialogTitle>
                      <DialogDescription id="audit-log-description">
                        Timeline of pipeline events for this run.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <ul className="space-y-0">
                        {logs.length === 0 ? (
                          <li className="py-4 text-center text-sm text-muted-foreground">
                            No log entries yet.
                          </li>
                        ) : (
                          logs.map((entry, i) => (
                            <li
                              key={entry.id}
                              className="relative flex gap-4 pb-6 last:pb-0"
                            >
                              {i < logs.length - 1 && (
                                <span
                                  className="absolute left-[11px] top-6 h-full w-px bg-border"
                                  aria-hidden
                                />
                              )}
                              <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-background text-xs font-medium text-primary">
                                {entry.id}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{entry.action}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(entry.created_at).toLocaleString()}
                                </p>
                                {entry.details != null &&
                                  typeof entry.details === "object" && (
                                    <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                                      {JSON.stringify(entry.details)}
                                    </pre>
                                  )}
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px] pr-4">
                  <ul className="space-y-0">
                    {logs.length === 0 ? (
                      <li className="py-4 text-center text-sm text-muted-foreground">
                        No log entries yet.
                      </li>
                    ) : (
                      logs.map((entry, i) => (
                        <li
                          key={entry.id}
                          className="relative flex gap-4 pb-6 last:pb-0 animate-slide-in"
                        >
                          {i < logs.length - 1 && (
                            <span
                              className="absolute left-[11px] top-6 h-full w-px bg-border"
                              aria-hidden
                            />
                          )}
                          <span
                            className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-background text-xs font-medium text-primary"
                            aria-hidden
                          >
                            {entry.id}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{entry.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString()}
                            </p>
                            {entry.details != null &&
                              typeof entry.details === "object" && (
                                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                                  {JSON.stringify(entry.details)}
                                </pre>
                              )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Outputs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Blueprint, BuildPlan, SecurityReport, SREStatus, FinOpsReport.
                  Live updates as each agent completes.
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="Blueprint" className="w-full">
                  <TabsList className="mb-2 flex w-full flex-wrap gap-1">
                    {AGENTS.map(({ label, outputKey }) => (
                      <TabsTrigger key={outputKey} value={label}>
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {AGENTS.map(({ label, outputKey }) => (
                    <TabsContent key={outputKey} value={label}>
                      {missionRun && missionRun[outputKey] != null ? (
                        <div
                          className={`rounded-md border p-2 transition-colors ${lastUpdatedOutputKey === outputKey ? "animate-just-updated rounded-md border-sky-500/40" : "border-transparent"}`}
                          aria-live="polite"
                          aria-label={
                            lastUpdatedOutputKey === outputKey
                              ? "Just updated"
                              : undefined
                          }
                        >
                          <JsonViewer data={missionRun[outputKey]} />
                        </div>
                      ) : (
                        <p className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                          No output yet.
                        </p>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {missionRun?.error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {missionRun.error}
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </>
  );
}

function AgentCard({
  step,
  name,
  Icon,
  status,
  explanation,
}: {
  step: number;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  status: StepStatus;
  explanation?: string;
}) {
  void step;
  return (
    <Card
      className={`transition-all duration-300 ease-out ${
        status === "RUNNING"
          ? "ring-2 ring-primary/50 shadow-md animate-status-pulse"
          : status === "DONE"
            ? "ring-1 ring-emerald-500/20"
            : status === "FAILED" || status === "BLOCKED"
              ? "ring-1 ring-destructive/20"
              : ""
      }`}
      title={explanation}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" />
            {name}
          </CardTitle>
          <StatusIcon status={status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Badge
          variant={stepBadgeVariant(status)}
          className="transition-all duration-300"
        >
          {status}
        </Badge>
        {explanation && (
          <p className="mt-2 text-xs text-muted-foreground" title={explanation}>
            {explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "DONE":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "RUNNING":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case "BLOCKED":
      return <Ban className="h-5 w-5 text-amber-500" />;
    case "FAILED":
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function stepBadgeVariant(
  status: StepStatus,
): "pending" | "running" | "done" | "blocked" | "failed" {
  return status.toLowerCase() as
    | "pending"
    | "running"
    | "done"
    | "blocked"
    | "failed";
}

function runStatusVariant(
  status: RunDetail["status"],
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "pending"
  | "running"
  | "done"
  | "blocked"
  | "failed" {
  switch (status) {
    case "completed":
      return "done";
    case "running":
      return "running";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function GlobeSkeleton() {
  return (
    <div
      className="min-h-[50vh] sm:min-h-[55vh] h-[55vh] sm:h-[60vh] w-full rounded-xl border border-sky-500/20 bg-slate-950/60 flex items-center justify-center"
      aria-busy="true"
      aria-label="Loading globe"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-24 w-24 rounded-full bg-muted/50 animate-pulse" />
        <span className="text-sm">Initializing world map…</span>
      </div>
    </div>
  );
}

function AgentStripSkeleton() {
  return (
    <div className="flex flex-wrap gap-3">
      {AGENTS.map(({ name }) => (
        <div
          key={name}
          className="h-12 w-28 rounded-lg bg-muted/50 animate-pulse"
          aria-hidden
        />
      ))}
    </div>
  );
}

function AgentStripItem({
  step,
  name,
  icon: Icon,
  status,
  thinking,
  explain,
}: {
  step: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  status: StepStatus;
  thinking: string;
  explain: string;
}) {
  void step;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-300 ${
        status === "RUNNING"
          ? "ring-2 ring-primary/40 bg-primary/5 animate-status-pulse"
          : status === "DONE"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : status === "FAILED" || status === "BLOCKED"
              ? "border-destructive/30 bg-destructive/5"
              : "border-muted bg-muted/20"
      }`}
      title={explain}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium text-sm">{name}</span>
      <StatusIcon status={status} />
      <span
        className="text-xs text-muted-foreground max-w-[200px] sm:max-w-none truncate sm:whitespace-normal"
        title={thinking}
      >
        {status !== "PENDING" ? thinking : "Pending…"}
      </span>
      {(status === "BLOCKED" || status === "FAILED") && (
        <span
          className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
          title={explain}
        >
          <HelpCircle className="h-3 w-3" /> Explain
        </span>
      )}
    </div>
  );
}
