import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4001";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 12);
    const workspaceName = name ? `${name}'s Workspace` : "My Workspace";

    // Create workspace in orchestrator so runs can be scoped to it
    const createRes = await fetch(`${ORCHESTRATOR_URL}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("[signup] Orchestrator workspace create failed:", err);
      return NextResponse.json(
        { error: "Failed to create workspace. Is the orchestrator running?" },
        { status: 502 },
      );
    }
    const workspace = (await createRes.json()) as {
      id: string;
      name: string;
      tier: string;
    };

    const user = await prisma.user.create({
      data: { email, name: name ?? email.split("@")[0], passwordHash },
    });
    await prisma.workspace.upsert({
      where: { id: workspace.id },
      create: { id: workspace.id, name: workspace.name },
      update: { name: workspace.name },
    });
    await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "admin" },
    });
  } catch (e) {
    console.error("[signup]", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
