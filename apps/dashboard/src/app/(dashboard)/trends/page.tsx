"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRuns, getRun } from "@/lib/orchestrator";
import { ArrowLeft, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart, Bar } from "recharts";

const MAX_RUNS = 30;

export default function TrendsPage() {
  const { data: session } = useSession();
  const auth = session?.workspaceId
    ? {
        workspaceId: session.workspaceId,
        userId: session.user?.email ?? undefined,
      }
    : undefined;
  const [costData, setCostData] = useState<{ date: string; cost: number }[]>(
    [],
  );
  const [passFailData, setPassFailData] = useState<
    { status: string; count: number }[]
  >([]);
  const [durationData, setDurationData] = useState<
    { id: string; duration: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const runs = await listRuns(undefined, auth).catch(() => []);
      const recent = runs.slice(0, MAX_RUNS);
      const details = await Promise.all(recent.map((r) => getRun(r.id, auth)));
      if (cancelled) return;
      const withCost = details
        .filter(
          (r): r is NonNullable<typeof r> =>
            r != null && r.status === "completed",
        )
        .map((r) => ({
          date: new Date(r.created_at).toLocaleDateString(),
          cost:
            r.finops_output &&
            typeof r.finops_output === "object" &&
            "estimatedMonthlyCost" in r.finops_output
              ? ((r.finops_output as { estimatedMonthlyCost?: number })
                  .estimatedMonthlyCost ?? 0)
              : 0,
        }));
      setCostData(withCost.reverse());
      const statusCounts: Record<string, number> = {
        completed: 0,
        failed: 0,
        blocked: 0,
      };
      details.forEach((r) => {
        if (r && r.status in statusCounts) statusCounts[r.status]++;
      });
      setPassFailData(
        [
          { status: "Pass", count: statusCounts.completed },
          { status: "Fail", count: statusCounts.failed },
          { status: "Blocked", count: statusCounts.blocked },
        ].filter((d) => d.count > 0),
      );
      const withDuration = details
        .filter(
          (r): r is NonNullable<typeof r> =>
            r != null &&
            (r.status === "completed" ||
              r.status === "failed" ||
              r.status === "blocked"),
        )
        .map((r) => ({
          id: r.id.slice(0, 8),
          duration: Math.round(
            (new Date(r.updated_at).getTime() -
              new Date(r.created_at).getTime()) /
              1000,
          ),
        }));
      setDurationData(withDuration.reverse());
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [session?.workspaceId]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrendingUp className="h-7 w-7" />
          Trends
        </h1>
        <p className="text-muted-foreground">
          Cost over time, pass/fail rate, and time-to-complete.
        </p>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Cost over time</CardTitle>
              </CardHeader>
              <CardContent>
                {costData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No completed runs with cost data.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={costData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        name="Est. $/mo"
                        stroke="hsl(var(--primary))"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pass / Fail rate</CardTitle>
              </CardHeader>
              <CardContent>
                {passFailData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={passFailData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name="Runs"
                        fill="hsl(var(--primary))"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Time to complete (seconds)</CardTitle>
              </CardHeader>
              <CardContent>
                {durationData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No finished runs.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={durationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="id" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="duration"
                        name="Seconds"
                        stroke="hsl(var(--primary))"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
