"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/env";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export default function StatusPage() {
  const [status, setStatus] = useState<{
    status: string;
    service?: string;
    last_deploy?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = env.NEXT_PUBLIC_ORCHESTRATOR_URL;
    fetch(`${base}/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: "unknown" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Platform status</h1>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {status?.status === "operational" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-amber-500" />
                )}
                {status?.status === "operational"
                  ? "Operational"
                  : (status?.status ?? "Unknown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {status?.service && <p>Service: {status.service}</p>}
              {status?.last_deploy && <p>Last deploy: {status.last_deploy}</p>}
              {!status?.last_deploy && status?.status === "operational" && (
                <p>
                  All systems normal. Set LAST_DEPLOY_TIME on the backend to
                  show last deploy time.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
