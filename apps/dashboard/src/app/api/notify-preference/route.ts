import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { createClient } from "@/lib/supabase/server";

/** PATCH /api/notify-preference — Set notifyRunComplete for current user in current workspace. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.id || !session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const notifyRunComplete = body.notifyRunComplete === true;
  const supabase = await createClient();
  await supabase
    .from("workspace_members")
    .update({ notify_run_complete: notifyRunComplete })
    .eq("user_id", session.user.id)
    .eq("workspace_id", session.workspaceId);
  return NextResponse.json({ notifyRunComplete });
}

/** GET /api/notify-preference — Get notifyRunComplete for current user in current workspace. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id || !session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("workspace_members")
    .select("notify_run_complete")
    .eq("user_id", session.user.id)
    .eq("workspace_id", session.workspaceId)
    .single();
  return NextResponse.json({
    notifyRunComplete: m?.notify_run_complete ?? false,
  });
}
