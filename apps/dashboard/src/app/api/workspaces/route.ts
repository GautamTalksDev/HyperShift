import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/workspaces — List workspaces the current user is a member of. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", session.user.id);
  if (!members?.length) return NextResponse.json({ workspaces: [] });
  const ids = members.map((m) => m.workspace_id);
  const { data: wsList } = await supabase
    .from("workspaces")
    .select("id, name")
    .in("id", ids);
  const wsMap = new Map((wsList ?? []).map((w) => [w.id, w.name]));
  const workspaces = members.map((m) => ({
    id: m.workspace_id,
    name: wsMap.get(m.workspace_id) ?? m.workspace_id,
    role: m.role,
  }));
  workspaces.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ workspaces });
}
