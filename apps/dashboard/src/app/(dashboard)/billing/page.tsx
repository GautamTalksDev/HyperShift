"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/supabase-auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUsage } from "@/lib/orchestrator";
import { ArrowLeft, CreditCard, Loader2, Zap } from "lucide-react";

export default function BillingPage() {
  const { user, workspaceId } = useAuth();
  const auth = workspaceId
    ? { workspaceId, userId: user?.email ?? undefined }
    : undefined;
  const [usage, setUsage] = useState<{
    runs: number;
    limit: number;
    period: string;
    tier: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 10000);
    getUsage(auth)
      .then((u) =>
        setUsage({
          runs: u.runs,
          limit: u.limit,
          period: u.period,
          tier: u.tier,
        }),
      )
      .catch(() => setUsage(null))
      .finally(() => {
        window.clearTimeout(timeout);
        setLoading(false);
      });
  }, [auth?.workspaceId]);

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    if (params.get("success") === "1")
      setMessage({
        type: "success",
        text: "Subscription updated. You're on Pro.",
      });
    if (params.get("cancel") === "1")
      setMessage({ type: "info", text: "Checkout cancelled." });
  }, []);

  async function handleUpgrade() {
    setCheckoutLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to start checkout",
        });
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to open portal",
        });
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setPortalLoading(false);
    }
  }

  const isPro = usage?.tier === "pro";

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
          <CreditCard className="h-7 w-7" />
          Billing & plan
        </h1>
        {message && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              message.type === "success"
                ? "border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-200"
                : message.type === "error"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-muted bg-muted/50 text-muted-foreground"
            }`}
          >
            {message.text}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Current plan
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${isPro ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {usage?.tier ?? "free"}
                </span>
              </CardTitle>
              <CardDescription>
                Usage this period: {usage?.runs ?? 0} / {usage?.limit ?? 10}{" "}
                runs · {usage?.period ?? ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPro ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Manage subscription
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Pro for 1,000 runs/month. You&apos;ll be
                    redirected to Stripe to complete payment.
                  </p>
                  <Button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="gap-2"
                  >
                    {checkoutLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
