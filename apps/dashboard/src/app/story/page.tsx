"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Layout,
  Hammer,
  Shield,
  Activity,
  DollarSign,
  ArrowRight,
  Rocket,
  ArrowLeft,
} from "lucide-react";

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </div>

      <article
        className="mx-auto max-w-3xl px-6 py-16 space-y-20"
        aria-label="HyperShift story"
      >
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            What is HyperShift?
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From idea to deployed pipeline in one flow — with security,
            reliability, and cost built in.
          </p>
        </section>

        {/* Problem */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">The problem</h2>
          <p className="text-muted-foreground leading-relaxed">
            Shipping software today means juggling architecture decisions, build
            pipelines, security checks, reliability tooling, and cost controls.
            Teams stitch together dozens of tools and hope nothing breaks in
            production. Deployments get delayed; security slips in at the end;
            costs spiral.
          </p>
        </section>

        {/* Solution */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">The solution</h2>
          <p className="text-muted-foreground leading-relaxed">
            HyperShift is an agent-powered pipeline that takes your intent —
            &ldquo;deploy a Next.js app with auth and a blog&rdquo; — and runs
            it through a single, auditable flow. Five specialized agents work in
            sequence: the Architect designs the blueprint, the Builder produces
            the plan, the Sentinel enforces security, SRE handles reliability
            and rollback, and FinOps keeps cost visible. You get one dashboard,
            one audit trail, and one place to see exactly what happened.
          </p>
        </section>

        {/* How it works: agent pipeline */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">
            How it works: the agent pipeline
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Every run flows through the same pipeline. Each step is visible, and
            each agent has a clear job.
          </p>
          <ul className="space-y-6 list-none p-0 m-0">
            <li>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Layout className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-semibold">Architect</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Turns your description into a blueprint: stack choices,
                        integrations, and structure. Uses context from your
                        repos and docs so the design fits your world.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
            <li>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Hammer className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-semibold">Builder</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Takes the blueprint and produces a concrete build plan:
                        where to deploy (Vercel, Railway, Supabase, etc.), how
                        to wire services, and what to run. Ready for the next
                        gate.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
            <li>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-semibold">Sentinel</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Security gate. Scans the plan and outputs for risks. If
                        something doesn’t pass, the pipeline can block and
                        explain why — so you fix before deploy, not after.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
            <li>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-semibold">SRE</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reliability and operations. Monitors health, detects
                        incidents, and can recommend or execute rollback. Keeps
                        the system stable after it’s live.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
            <li>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <DollarSign
                        className="h-5 w-5 text-primary"
                        aria-hidden
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">FinOps</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cost visibility and optimization. Estimates spend, flags
                        waste, and helps you stay within budget. No surprise
                        bills.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Together, they form a single story: your intent → blueprint → build
            plan → security check → reliability and cost view. You see it all in
            one run: timeline, audit log, and outputs. When something fails or
            gets blocked, you know which step and why.
          </p>
        </section>

        {/* CTA */}
        <section className="text-center space-y-6 py-8">
          <h2 className="text-2xl font-semibold">Ready to try it?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Sign in to start a pipeline run. Describe what you want to deploy;
            we’ll run the agents and show you the result.
          </p>
          <Link href="/login">
            <Button size="lg" className="gap-2">
              <Rocket className="h-5 w-5" />
              Go to HyperShift
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </article>
    </main>
  );
}
