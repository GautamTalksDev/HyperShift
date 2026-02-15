"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSession, signOut } from "next-auth/react";
import {
  listRuns,
  createRun,
  whatIf,
  getUsage,
  ORCHESTRATOR_UNREACHABLE_MSG,
  type RunSummary,
} from "@/lib/orchestrator";
import { generateCodename } from "@/lib/codenames";
import {
  Rocket,
  ListChecks,
  Loader2,
  AlertCircle,
  Zap,
  ShieldAlert,
  Filter,
  Calculator,
  LogOut,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SettingsDialog } from "@/components/settings-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const auth = session?.workspaceId
    ? {
        workspaceId: session.workspaceId,
        userId: session.user?.email ?? undefined,
      }
    : undefined;
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [constraints, setConstraints] = useState("");
  const [codename, setCodename] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatIfAddition, setWhatIfAddition] = useState("");
  const [whatIfResult, setWhatIfResult] = useState<{
    estimatedMonthlyCost: number;
    riskLevel: string;
    message: string;
  } | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [orchestratorOffline, setOrchestratorOffline] = useState(false);
  const [archestraPrompt, setArchestraPrompt] = useState("");
  const [archestraReply, setArchestraReply] = useState<string | null>(null);
  const [archestraLoading, setArchestraLoading] = useState(false);
  const [usage, setUsage] = useState<{
    runs: number;
    limit: number;
    period: string;
    tier: string;
  } | null>(null);
  const [requireApproval, setRequireApproval] = useState(false);

  useEffect(() => {
    if (orchestratorOffline) return;
    getUsage(auth)
      .then((u) =>
        setUsage({
          runs: u.runs,
          limit: u.limit,
          period: u.period,
          tier: u.tier,
        }),
      )
      .catch(() => setUsage(null));
  }, [orchestratorOffline, runs.length, session?.workspaceId]);

  useEffect(() => {
    let cancelled = false;
    function fetchRuns() {
      listRuns(tagFilter ? { tag: tagFilter } : undefined, auth)
        .then((data) => {
          if (!cancelled) {
            setRuns(data);
            setOrchestratorOffline(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setRuns([]);
            setOrchestratorOffline(
              err instanceof Error &&
                err.message === ORCHESTRATOR_UNREACHABLE_MSG,
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    fetchRuns();
    const pollMs = orchestratorOffline ? 10_000 : 2000;
    const interval = setInterval(fetchRuns, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tagFilter, orchestratorOffline, session?.workspaceId]);

  async function runWithIntent(
    user_intent: {
      description: string;
      target?: string;
      constraints?: string;
    },
    opts?: { codename?: string; tags?: string[]; require_approval?: boolean },
  ) {
    setError(null);
    setSubmitting(true);
    try {
      const { run_id } = await createRun(user_intent, opts, auth);
      router.push(`/runs/${run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput.trim()
      ? tagsInput
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    await runWithIntent(
      {
        description: description.trim() || "Deploy my app",
        target: target.trim() || undefined,
        constraints: constraints.trim() || undefined,
      },
      {
        codename: codename.trim() || generateCodename(),
        tags,
        require_approval: requireApproval,
      },
    );
  }

  async function handleWhatIf() {
    if (!description.trim()) return;
    setWhatIfLoading(true);
    setWhatIfResult(null);
    try {
      const result = await whatIf(
        {
          description: description.trim(),
          target: target.trim() || undefined,
          constraints: constraints.trim() || undefined,
        },
        whatIfAddition.trim() || undefined,
        auth,
      );
      setWhatIfResult({
        estimatedMonthlyCost: result.estimatedMonthlyCost,
        riskLevel: result.riskLevel,
        message: result.message,
      });
    } catch {
      setWhatIfResult({
        estimatedMonthlyCost: 0,
        riskLevel: "unknown",
        message: "Estimate failed.",
      });
    } finally {
      setWhatIfLoading(false);
    }
  }

  async function handleArchestraChat() {
    if (!archestraPrompt.trim()) return;
    setArchestraLoading(true);
    setArchestraReply(null);
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "architect",
          messages: [{ role: "user", content: archestraPrompt.trim() }],
          maxTokens: 512,
          useArchestra: true,
        }),
      });
      const data = (await res.json()) as { content?: string };
      setArchestraReply(
        typeof data.content === "string" ? data.content : "[No response]",
      );
    } catch {
      setArchestraReply(
        "[Request failed. Is Archestra running and ARCHESTRA_API_URL/KEY set?]",
      );
    } finally {
      setArchestraLoading(false);
    }
  }

  function handleSignOut() {
    signOut({ callbackUrl: "/login" });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <OnboardingTour />
      {orchestratorOffline && (
        <div className="sticky top-0 z-50 border-b border-amber-500/50 bg-amber-500/15 px-4 py-3 text-center text-sm text-amber-800 dark:text-amber-200">
          <strong>Orchestrator is not running.</strong> Run{" "}
          <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">
            pnpm dev
          </code>{" "}
          from the <strong>repo root</strong> (not only{" "}
          <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">
            apps/dashboard
          </code>
          ) so the orchestrator starts on port 4001.
        </div>
      )}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                <Rocket className="h-8 w-8 text-primary" />
                <Link href="/" className="hover:opacity-90">
                  HyperShift
                </Link>
              </h1>
              <p className="mt-2 text-muted-foreground">
                Start a pipeline run: Architect → Builder → Sentinel → SRE →
                FinOps.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              <WorkspaceSwitcher />
              {usage != null && (
                <span
                  className="rounded-md border bg-muted/50 px-3 py-2 text-muted-foreground"
                  title={`Period: ${usage.period} (${usage.tier} tier)`}
                >
                  Runs: {usage.runs} / {usage.limit}
                </span>
              )}
              <Link
                href="/billing"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent flex items-center gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" /> Billing
              </Link>
              <Link
                href="/workspaces"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Workspaces
              </Link>
              <Link
                href="/api-keys"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                API keys
              </Link>
              <Link
                href="/help"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Help
              </Link>
              <Link
                href="/insights"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Insights
              </Link>
              <Link
                href="/status"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Status
              </Link>
              <Link
                href="/story"
                className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Story
              </Link>
              <Link
                href="/trends"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Trends
              </Link>
              <Link
                href="/compare"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Compare runs
              </Link>
              <Link
                href="/fleet"
                className="rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent"
              >
                Fleet health
              </Link>
              <SettingsDialog />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </nav>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ListChecks className="h-5 w-5" />
                New run
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Describe what you want to deploy. The orchestrator will run all
                agents in sequence.
              </p>
              {description.toLowerCase().includes("production") && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-2 py-1.5 mt-2">
                  Recommendation: teams with similar intent often add{" "}
                  <strong>Sentry</strong> (error tracking) and{" "}
                  <strong>health checks</strong>.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDescription("Deploy a simple Next.js landing page");
                    setTarget("local");
                    setConstraints("use free tier only");
                    setCodename(generateCodename());
                    runWithIntent(
                      {
                        description: "Deploy a simple Next.js landing page",
                        target: "local",
                        constraints: "use free tier only",
                      },
                      {
                        codename: generateCodename(),
                        tags: ["demo", "happy-path"],
                      },
                    );
                  }}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <Zap className="h-4 w-4" />
                  Happy Path
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDescription("Deploy app with sabotage demo");
                    setTarget("local");
                    setConstraints("");
                    runWithIntent(
                      {
                        description: "Deploy app with sabotage demo",
                        target: "local",
                        constraints: "",
                      },
                      {
                        codename: generateCodename(),
                        tags: ["demo", "sabotage"],
                      },
                    );
                  }}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Sabotage Deploy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g. Deploy a Next.js app with Supabase auth and a blog"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target (optional)</Label>
                  <Input
                    id="target"
                    placeholder="e.g. production"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="constraints">Constraints (optional)</Label>
                  <Input
                    id="constraints"
                    placeholder="e.g. use free tier only"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codename">Codename (optional)</Label>
                  <Input
                    id="codename"
                    placeholder="e.g. Operation Phoenix (or leave blank to auto-generate)"
                    value={codename}
                    onChange={(e) => setCodename(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g. production, demo"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="require-approval"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label
                    htmlFor="require-approval"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Require approval before production deploy
                  </Label>
                </div>
                <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> What-if: estimated
                    cost/risk
                  </p>
                  <p className="text-xs text-muted-foreground">
                    For real estimates, set FINOPS_AGENT_URL and
                    ARCHITECT_AGENT_URL in the orchestrator environment (see
                    ENV.md).
                  </p>
                  <Input
                    placeholder="e.g. add Redis cache, add Postgres"
                    value={whatIfAddition}
                    onChange={(e) => setWhatIfAddition(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={whatIfLoading}
                    onClick={handleWhatIf}
                  >
                    {whatIfLoading ? "Estimating…" : "Estimate"}
                  </Button>
                  {whatIfResult && (
                    <p className="text-sm text-muted-foreground">
                      {whatIfResult.message}
                    </p>
                  )}
                </div>
                {error && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                    {(error.includes("limit exceeded") ||
                      error.includes("Upgrade to Pro")) && (
                      <Link
                        href="/billing"
                        className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        <CreditCard className="h-3 w-3" /> Upgrade to Pro
                      </Link>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Start pipeline"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-indigo-500/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                HyperShift + Archestra
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Send a message through Archestra’s gateway.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Ask anything… (routed via Archestra)"
                value={archestraPrompt}
                onChange={(e) => setArchestraPrompt(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={archestraLoading}
                onClick={handleArchestraChat}
              >
                {archestraLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send via Archestra"
                )}
              </Button>
              {archestraReply !== null && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {archestraReply}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Recent runs</CardTitle>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by tag"
                    className="h-8 w-40 text-sm"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Click a run to see the live timeline and outputs. Filter by tag
                to narrow list.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : runs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {tagFilter
                    ? "No runs with this tag."
                    : "No runs yet. Start one above."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {runs.slice(0, 10).map((run) => (
                    <li key={run.id}>
                      <Link
                        href={`/runs/${run.id}`}
                        className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
                      >
                        <span className="truncate font-mono text-muted-foreground">
                          {run.codename || run.id}
                        </span>
                        <Badge variant={statusVariant(run.status)}>
                          {run.status}
                        </Badge>
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 pl-3 text-xs text-muted-foreground">
                        {!run.codename && (
                          <span className="font-mono">{run.id}</span>
                        )}
                        {run.codename && <span>{run.id}</span>}
                        {Array.isArray(run.tags) && run.tags.length > 0 && (
                          <span className="flex gap-1">
                            {run.tags.map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {t}
                              </Badge>
                            ))}
                          </span>
                        )}
                        <span>{new Date(run.created_at).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function statusVariant(
  status: RunSummary["status"],
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
    case "failed":
    case "blocked":
      return status === "blocked" ? "blocked" : "failed";
    default:
      return "pending";
  }
}
