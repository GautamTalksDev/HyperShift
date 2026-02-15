"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRuns, getRun, type RunDetail } from "@/lib/orchestrator";
import { JsonViewer } from "@/components/json-viewer";
import { ArrowLeft, GitCompare } from "lucide-react";

export default function ComparePage() {
  const { data: session } = useSession();
  const auth = session?.workspaceId
    ? {
        workspaceId: session.workspaceId,
        userId: session.user?.email ?? undefined,
      }
    : undefined;
  const [runs, setRuns] = useState<{ id: string; codename?: string | null }[]>(
    [],
  );
  const [runAId, setRunAId] = useState("");
  const [runBId, setRunBId] = useState("");
  const [runA, setRunA] = useState<RunDetail | null>(null);
  const [runB, setRunB] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRuns(undefined, auth)
      .then((data) =>
        setRuns(data.map((r) => ({ id: r.id, codename: r.codename }))),
      )
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [session?.workspaceId]);

  useEffect(() => {
    if (!runAId) {
      setRunA(null);
      return;
    }
    getRun(runAId, auth).then(setRunA);
  }, [runAId, auth?.workspaceId]);

  useEffect(() => {
    if (!runBId) {
      setRunB(null);
      return;
    }
    getRun(runBId, auth).then(setRunB);
  }, [runBId, auth?.workspaceId]);

  const cost = (r: RunDetail | null) => {
    if (
      !r?.finops_output ||
      typeof r.finops_output !== "object" ||
      !("estimatedMonthlyCost" in r.finops_output)
    )
      return "—";
    return `$${(r.finops_output as { estimatedMonthlyCost?: number }).estimatedMonthlyCost ?? 0}/mo`;
  };
  const findings = (r: RunDetail | null) => {
    if (
      !r?.sentinel_output ||
      typeof r.sentinel_output !== "object" ||
      !("findings" in r.sentinel_output)
    )
      return [];
    return (r.sentinel_output as { findings?: unknown[] }).findings ?? [];
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompare className="h-7 w-7" />
          Compare runs
        </h1>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Run A</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={runAId}
              onChange={(e) => setRunAId(e.target.value)}
            >
              <option value="">Select run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.codename || r.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Run B</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={runBId}
              onChange={(e) => setRunBId(e.target.value)}
            >
              <option value="">Select run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.codename || r.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-muted-foreground">Loading runs…</p>}

        {(runA || runB) && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  Run A {runA ? `— ${runA.codename || runA.id}` : ""}
                </CardTitle>
                {runA && (
                  <p className="text-sm text-muted-foreground">
                    {runA.user_intent?.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {runA ? (
                  <>
                    <p>
                      <strong>Status:</strong> {runA.status}
                    </p>
                    <p>
                      <strong>Cost:</strong> {cost(runA)}
                    </p>
                    <p>
                      <strong>Findings:</strong> {findings(runA).length}
                    </p>
                    <details className="text-sm">
                      <summary>Blueprint</summary>
                      <JsonViewer data={runA.architect_output} />
                    </details>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a run.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  Run B {runB ? `— ${runB.codename || runB.id}` : ""}
                </CardTitle>
                {runB && (
                  <p className="text-sm text-muted-foreground">
                    {runB.user_intent?.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {runB ? (
                  <>
                    <p>
                      <strong>Status:</strong> {runB.status}
                    </p>
                    <p>
                      <strong>Cost:</strong> {cost(runB)}
                    </p>
                    <p>
                      <strong>Findings:</strong> {findings(runB).length}
                    </p>
                    <details className="text-sm">
                      <summary>Blueprint</summary>
                      <JsonViewer data={runB.architect_output} />
                    </details>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a run.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
