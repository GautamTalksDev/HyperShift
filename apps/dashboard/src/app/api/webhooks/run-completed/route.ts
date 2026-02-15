import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SECRET = process.env.WEBHOOK_RUN_COMPLETED_SECRET ?? "";

/** POST /api/webhooks/run-completed — Called by orchestrator when a run completes. Query: ?secret=xxx. Body: either { event, payload, ts } (orchestrator envelope) or { run_id, workspace_id, status }. Sends email to workspace members who have notifyRunComplete (if RESEND_API_KEY set). */
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
      ? (body.payload as {
          run_id?: string;
          workspace_id?: string;
          status?: string;
          deployment_url?: string;
          error?: string;
          failed_step?: string;
        })
      : (body as {
          run_id?: string;
          workspace_id?: string;
          status?: string;
          deployment_url?: string;
          error?: string;
          failed_step?: string;
        });
  const { run_id, workspace_id, status } = payload;
  if (!run_id || !workspace_id) {
    return NextResponse.json(
      { error: "run_id and workspace_id required" },
      { status: 400 },
    );
  }
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace_id, notifyRunComplete: true },
    include: { user: true },
  });
  const emails = members.map((m) => m.user.email).filter(Boolean) as string[];
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
        console.error(
          "[run-completed webhook] Resend failed:",
          await res.text(),
        );
    } catch (e) {
      console.error("[run-completed webhook]", e);
    }
  } else if (emails.length > 0) {
    console.log(
      "[run-completed webhook] Would email",
      emails,
      "for run",
      run_id,
      "status",
      status,
      "(set RESEND_API_KEY to send)",
    );
  }
  return NextResponse.json({ received: true });
}
