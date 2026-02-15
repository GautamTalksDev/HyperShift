import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-server";
import { prisma } from "@/lib/db";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";

/** POST /api/workspaces/create — Create a new workspace and add current user as admin. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
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
  await prisma.workspace.upsert({
    where: { id: workspace.id },
    create: { id: workspace.id, name: workspace.name },
    update: { name: workspace.name },
  });
  await prisma.workspaceMember.create({
    data: { userId: session.user.id, workspaceId: workspace.id, role: "admin" },
  });
  return NextResponse.json(workspace);
}
