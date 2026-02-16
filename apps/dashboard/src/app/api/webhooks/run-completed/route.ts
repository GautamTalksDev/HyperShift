import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const SECRET = process.env.WEBHOOK_RUN_COMPLETED_SECRET ?? "";

/** POST /api/webhooks/run-completed — Called by orchestrator when a run completes. Sends email to workspace members who have notify_run_complete (if RESEND_API_KEY set). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (SECRET && url.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload =
    body.event === "run.completed" &&
    body.payload &&
    typeof body.payload === "object"
      ? (body.payload as { run_id?: string; workspace_id?: string; status?: string; deployment_url?: string; error?: string; failed_step?: string })
      : (body as { run_id?: string; workspace_id?: string; status?: string; deployment_url?: string; error?: string; failed_step?: string });
  const { run_id, workspace_id, status } = payload;
  if (!run_id || !workspace_id) {
    return NextResponse.json(
      { error: "run_id and workspace_id required" },
      { status: 400 },
    );
  }
  const supabase = createServiceClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace_id)
    .eq("notify_run_complete", true);
  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return NextResponse.json({ received: true });
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", userIds);
  const emails = (profiles ?? []).map((p) => p.email).filter(Boolean) as string[];
  if (emails.length > 0 && process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:
            process.env.RESEND_FROM ?? "HyperShift <notifications@example.com>",
          to: emails,
          subject: `Run ${run_id} ${status === "completed" ? "completed" : "failed"}`,
          text: `Run ${run_id} ${status ?? "finished"}. Workspace: ${workspace_id}. ${payload.deployment_url ? `Deployment: ${payload.deployment_url}` : ""} ${payload.error ? `Error: ${payload.error}` : ""}`,
        }),
      });
      if (!res.ok)
        console.error("[run-completed webhook] Resend failed:", await res.text());
    } catch (e) {
      console.error("[run-completed webhook]", e);
    }
  } else if (emails.length > 0) {
    console.log(
      "[run-completed webhook] Would email",
      emails,
      "for run",
      run_id,
      "(set RESEND_API_KEY to send)",
    );
  }
  return NextResponse.json({ received: true });
}
