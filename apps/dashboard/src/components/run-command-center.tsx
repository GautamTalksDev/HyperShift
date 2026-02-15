"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { RunDetail } from "@/lib/orchestrator";
import type { AgentStates, Connection } from "@/types";
import { agentOrder } from "@/utils/agents";
import { getAgentById } from "@/utils/agents";
import { Activity, DollarSign } from "lucide-react";

interface RunCommandCenterProps {
  run: RunDetail;
  agentStates: AgentStates;
  connections: Connection[];
}

export function RunCommandCenter({
  run,
  agentStates,
  connections,
}: RunCommandCenterProps) {
  const cost =
    run.finops_output &&
    typeof run.finops_output === "object" &&
    "estimatedMonthlyCost" in run.finops_output
      ? ((run.finops_output as { estimatedMonthlyCost?: number })
          .estimatedMonthlyCost ?? 0)
      : null;

  return (
    <section className="rounded-lg border-2 border-primary/20 bg-muted/10 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Command center
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Activity className="h-4 w-4" /> Agent flow
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {agentOrder.map((id, i) => {
              const state = agentStates[id];
              const name = getAgentById(id)?.name ?? id;
              const color =
                state === "active"
                  ? "bg-sky-500"
                  : state === "complete"
                    ? "bg-emerald-500"
                    : state === "blocked" || state === "failed"
                      ? "bg-red-500"
                      : "bg-muted";
              return (
                <span key={id} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-sm">{name}</span>
                  {i < agentOrder.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {connections.filter((c) => c.active).length} active connection(s)
          </p>
        </div>
        {cost !== null && (
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-4 w-4" /> FinOps — Estimated cost
              </p>
              <p className="mt-1 text-2xl font-semibold">
                ${cost}
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              </p>
            </CardContent>
          </Card>
        )}
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Full 3D globe and neural graph available in{" "}
          <Link
            href="/demo"
            className="font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Mission Control (demo)
          </Link>
          .
        </div>
      </div>
    </section>
  );
}
