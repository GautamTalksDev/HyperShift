"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, BookOpen, Bell, HelpCircle, Mail } from "lucide-react";

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? "";
const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL ??
  "https://github.com/your-org/hypershift#readme";

export default function HelpPage() {
  const [notifyRunComplete, setNotifyRunComplete] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notify-preference")
      .then((r) => (r.ok ? r.json() : { notifyRunComplete: false }))
      .then((d) => {
        setNotifyRunComplete(d.notifyRunComplete ?? false);
      })
      .catch(() => {})
      .finally(() => setNotifyLoading(false));
  }, []);

  const onNotifyChange = (checked: boolean) => {
    setNotifyRunComplete(checked);
    fetch("/api/notify-preference", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyRunComplete: checked }),
    }).catch(() => {});
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <HelpCircle className="h-7 w-7" />
          Help & support
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" /> Docs & getting started
            </CardTitle>
            <CardDescription>
              Learn how to create runs, use the CLI, and configure agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              View documentation →
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">FAQ</CardTitle>
            <CardDescription>Common questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">How do I create a run?</p>
              <p className="text-muted-foreground">
                From the dashboard, enter a description (e.g. &quot;Deploy a
                Next.js app&quot;) and click Start pipeline. The run will go
                through Architect → Builder → Sentinel → SRE → FinOps.
              </p>
            </div>
            <div>
              <p className="font-medium">How do I use the CLI?</p>
              <p className="text-muted-foreground">
                Set HYPERSHIFT_ORCHESTRATOR_URL and optionally
                HYPERSHIFT_WORKSPACE_ID and HYPERSHIFT_API_KEY. Run{" "}
                <code className="rounded bg-muted px-1">
                  hypershift run &quot;your intent&quot;
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1">
                  hypershift runs list
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1">
                  hypershift runs logs &lt;id&gt;
                </code>
                .
              </p>
            </div>
            <div>
              <p className="font-medium">Run limit exceeded?</p>
              <p className="text-muted-foreground">
                Upgrade to Pro from the Billing page for 1,000 runs/month.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" /> Run notifications
            </CardTitle>
            <CardDescription>
              Get an email when a run completes or fails (for this workspace).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!notifyLoading && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={notifyRunComplete}
                  onCheckedChange={onNotifyChange}
                />
                <span className="text-sm">
                  Email me when a run completes or fails
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" /> Contact support
            </CardTitle>
            <CardDescription>Get help from the team.</CardDescription>
          </CardHeader>
          <CardContent>
            {SUPPORT_URL ? (
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Open support →
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set NEXT_PUBLIC_SUPPORT_URL in the dashboard environment to show
                a support link (e.g. mailto:support@example.com or a help desk
                URL).
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          <Link href="/status-page" className="underline hover:no-underline">
            Public status page
          </Link>{" "}
          — platform health without logging in.
        </p>
      </div>
    </main>
  );
}
