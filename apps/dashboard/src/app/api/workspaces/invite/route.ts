import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";

/** POST /api/workspaces/invite — Add a user to the current workspace by email. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id || !session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = ["admin", "operator", "viewer"].includes(body.role)
    ? body.role
    : "operator";
  const workspaceId = body.workspaceId ?? session.workspaceId;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("workspace_id", workspaceId)
    .single();
  if (
    !member ||
    (member.role !== "admin" && workspaceId !== session.workspaceId)
  ) {
    return NextResponse.json(
      { error: "You can only invite to workspaces where you are admin" },
      { status: 403 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (!profile?.id) {
    return NextResponse.json(
      {
        error: "No account found with that email. They need to sign up first.",
      },
      { status: 404 },
    );
  }

  const { error: insertError } = await supabase
    .from("workspace_members")
    .insert({ user_id: profile.id, workspace_id: workspaceId, role });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 },
      );
    }
    throw insertError;
  }
  return NextResponse.json({ ok: true });
}
