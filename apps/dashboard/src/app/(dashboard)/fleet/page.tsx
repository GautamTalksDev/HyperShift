"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFleetHealth } from "@/lib/orchestrator";
import { ArrowLeft, Activity } from "lucide-react";

export default function FleetHealthPage() {
  const [health, setHealth] = useState<{
    orchestrator: "ok";
    agents: Record<string, "ok" | "down">;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFleetHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      getFleetHealth()
        .then(setHealth)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Activity className="h-7 w-7" />
          Fleet health
        </h1>
        <p className="text-muted-foreground">
          Status of orchestrator and all agents.
        </p>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : health ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Orchestrator</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    health.orchestrator === "ok" ? "done" : "destructive"
                  }
                >
                  {health.orchestrator}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(health.agents).map(([name, status]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <span className="capitalize">{name}</span>
                      <Badge variant={status === "ok" ? "done" : "destructive"}>
                        {status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Orchestrator is not running.</p>
            <p className="mt-1 text-muted-foreground">
              Run{" "}
              <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-xs">
                pnpm dev
              </code>{" "}
              from the
              <strong>repo</strong> root so the orchestrator starts on port
              4001.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
