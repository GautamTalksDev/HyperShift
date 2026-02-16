import { createClient } from "./server";
import { cookies } from "next/headers";

const WORKSPACE_COOKIE = "hypershift_workspace_id";

export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const cookieStore = await cookies();
  const workspaceId =
    cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", session.user.id)
    .order("workspace_id");
  const list = members ?? [];
  const workspaceIdResolved =
    workspaceId && list.some((m) => m.workspace_id === workspaceId)
      ? workspaceId
      : list[0]?.workspace_id ?? null;
  const member = list.find((m) => m.workspace_id === workspaceIdResolved);
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.user_metadata?.full_name ?? undefined,
    },
    workspaceId: workspaceIdResolved,
    role: member?.role ?? null,
  };
}
