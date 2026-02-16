import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";

/** POST /api/workspaces/create — Create a new workspace and add current user as admin. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name =
    typeof body.name === "string" ? body.name.trim() : "New Workspace";
  const res = await fetch(`${ORCHESTRATOR_URL}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: err || "Failed to create workspace" },
      { status: res.status },
    );
  }
  const workspace = (await res.json()) as {
    id: string;
    name: string;
    tier: string;
  };
  const supabase = await createClient();
  await supabase.from("workspaces").upsert(
    { id: workspace.id, name: workspace.name },
    { onConflict: "id" },
  );
  await supabase.from("workspace_members").insert({
    user_id: session.user.id,
    workspace_id: workspace.id,
    role: "admin",
  });
  return NextResponse.json(workspace);
}
