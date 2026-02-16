"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/supabase-auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getUsage,
  getSlo,
  type UsageInfo,
  type SloInfo,
} from "@/lib/orchestrator";
import { BarChart3, ArrowLeft, Loader2 } from "lucide-react";

export default function InsightsPage() {
  const { user, workspaceId } = useAuth();
  const auth = workspaceId
    ? { workspaceId, userId: user?.email ?? undefined }
    : undefined;
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [slo7, setSlo7] = useState<SloInfo | null>(null);
  const [slo30, setSlo30] = useState<SloInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getUsage(auth), getSlo(7, auth), getSlo(30, auth)])
      .then(([u, s7, s30]) => {
        setUsage(u);
        setSlo7(s7);
        setSlo30(s30);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-7 w-7" />
          Insights & pipeline health
        </h1>
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          {usage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage this period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Workspace: {usage.workspace_id}
                </p>
                <p className="text-2xl font-semibold">
                  {usage.runs} / {usage.limit} runs
                </p>
                <p className="text-sm text-muted-foreground">
                  Tier: {usage.tier} · Period: {usage.period}
                </p>
              </CardContent>
            </Card>
          )}
          {slo7 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SLO — last 7 days</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">
                  {(slo7.success_rate * 100).toFixed(0)}% success rate
                </p>
                <p className="text-sm text-muted-foreground">
                  {slo7.success_count} completed, {slo7.failure_count} failed,{" "}
                  {slo7.blocked_count} blocked
                </p>
                {slo7.avg_duration_ms != null && (
                  <p className="text-sm text-muted-foreground">
                    Avg duration: {(slo7.avg_duration_ms / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {slo30 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SLO — last 30 days</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">
                  {(slo30.success_rate * 100).toFixed(0)}% success rate
                </p>
                <p className="text-sm text-muted-foreground">
                  {slo30.success_count} completed, {slo30.failure_count} failed,{" "}
                  {slo30.blocked_count} blocked
                </p>
                {slo30.avg_duration_ms != null && (
                  <p className="text-sm text-muted-foreground">
                    Avg duration: {(slo30.avg_duration_ms / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
