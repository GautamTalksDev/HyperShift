import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-server";
import { prisma } from "@/lib/db";

/** POST /api/workspaces/invite — Add a user to the current workspace by email. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
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

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (
    !member ||
    (member.role !== "admin" && workspaceId !== session.workspaceId)
  ) {
    return NextResponse.json(
      { error: "You can only invite to workspaces where you are admin" },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      {
        error: "No account found with that email. They need to sign up first.",
      },
      { status: 404 },
    );
  }

  try {
    await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId, role },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 },
      );
    }
    throw e;
  }
}
