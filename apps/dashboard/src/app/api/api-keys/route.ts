import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";
const SECRET = process.env.WORKSPACE_TIER_UPDATE_SECRET ?? "";

function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (SECRET) h["X-Webhook-Secret"] = SECRET;
  return h;
}

/** GET /api/api-keys — List API keys for current workspace (proxy to orchestrator). */
export async function GET() {
  const session = await getSession();
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await fetch(
    `${ORCHESTRATOR_URL}/workspaces/${encodeURIComponent(session.workspaceId)}/api-keys`,
    { headers: headers() },
  );
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: err || "Failed to list API keys" },
      { status: res.status },
    );
  }
  const data = await res.json();
  return NextResponse.json(data);
}

/** POST /api/api-keys — Create API key for current workspace (proxy to orchestrator). Body: { name?: string }. Returns { key } once. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const res = await fetch(
    `${ORCHESTRATOR_URL}/workspaces/${encodeURIComponent(session.workspaceId)}/api-keys`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: body.name ?? "API key" }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: err || "Failed to create API key" },
      { status: res.status },
    );
  }
  const data = await res.json();
  return NextResponse.json(data);
}
