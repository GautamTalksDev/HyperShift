import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-server";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";

/** DELETE /api/api-keys/:keyId — Revoke API key (proxy to orchestrator). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { keyId } = await params;
  const headers: Record<string, string> = {};
  if (process.env.WORKSPACE_TIER_UPDATE_SECRET)
    headers["X-Webhook-Secret"] = process.env.WORKSPACE_TIER_UPDATE_SECRET;
  const res = await fetch(
    `${ORCHESTRATOR_URL}/workspaces/${encodeURIComponent(session.workspaceId)}/api-keys/${encodeURIComponent(keyId)}`,
    { method: "DELETE", headers },
  );
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: err || "Failed to revoke" },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true });
}
