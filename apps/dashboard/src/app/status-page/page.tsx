"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";

/** Public status page — no login required. Use /status-page for status.yourdomain.com or linking from docs. */
export default function PublicStatusPage() {
  const [status, setStatus] = useState<{
    status: string;
    service?: string;
    last_deploy?: string | null;
  } | null>(null);
  const [fleet, setFleet] = useState<{
    orchestrator: string;
    agents?: Record<string, string>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${ORCHESTRATOR_URL}/status`)
        .then((r) => r.json())
        .catch(() => ({ status: "unknown" })),
      fetch(`${ORCHESTRATOR_URL}/fleet-health`)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([s, f]) => {
        setStatus(s);
        setFleet(f);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">HyperShift status</h1>
        <p className="text-sm text-muted-foreground">
          Platform health. No login required.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {status?.status === "operational" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  {status?.status === "operational"
                    ? "All systems operational"
                    : (status?.status ?? "Unknown")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {status?.service && <p>Service: {status.service}</p>}
                {status?.last_deploy && (
                  <p>Last deploy: {status.last_deploy}</p>
                )}
              </CardContent>
            </Card>
            {fleet?.agents && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Components</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    <li className="flex justify-between">
                      <span>Orchestrator</span>
                      <span>
                        {fleet.orchestrator === "ok"
                          ? "Operational"
                          : fleet.orchestrator}
                      </span>
                    </li>
                    {Object.entries(fleet.agents).map(([name, s]) => (
                      <li key={name} className="flex justify-between">
                        <span>{name}</span>
                        <span>{s === "ok" ? "Operational" : "Down"}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline hover:no-underline">
            Sign in
          </Link>{" "}
          to the dashboard.
        </p>
      </div>
    </main>
  );
}
