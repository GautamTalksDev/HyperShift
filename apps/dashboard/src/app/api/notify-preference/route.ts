import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-server";
import { prisma } from "@/lib/db";

/** PATCH /api/notify-preference — Set notifyRunComplete for current user in current workspace. Body: { notifyRunComplete: boolean }. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const notifyRunComplete = body.notifyRunComplete === true;
  await prisma.workspaceMember.updateMany({
    where: { userId: session.user.id, workspaceId: session.workspaceId },
    data: { notifyRunComplete },
  });
  return NextResponse.json({ notifyRunComplete });
}

/** GET /api/notify-preference — Get notifyRunComplete for current user in current workspace. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const m = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId: session.workspaceId,
      },
    },
  });
  return NextResponse.json({
    notifyRunComplete: m?.notifyRunComplete ?? false,
  });
}
