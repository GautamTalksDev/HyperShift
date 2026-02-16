import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    const supabase = createServiceClient();
    const workspaceName = name ? `${name}'s Workspace` : "My Workspace";

    const { data: createUserData, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name ?? email.split("@")[0] },
      });
    if (createUserError || !createUserData.user) {
      console.error("[signup] Supabase createUser:", createUserError);
      const msg = createUserError?.message ?? "Failed to create account.";
      const isConflict = /already exists|already registered/i.test(msg);
      return NextResponse.json(
        { error: isConflict ? "An account with this email already exists." : msg },
        { status: isConflict ? 409 : 500 },
      );
    }
    const userId = createUserData.user.id;

    let createRes: Response;
    try {
      createRes = await fetch(`${ORCHESTRATOR_URL}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });
    } catch (fetchErr) {
      console.error("[signup] Orchestrator unreachable:", fetchErr);
      return NextResponse.json(
        {
          error:
            "Cannot reach the backend. Set NEXT_PUBLIC_ORCHESTRATOR_URL in Vercel.",
        },
        { status: 502 },
      );
    }
    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("[signup] Orchestrator workspace create failed:", err);
      return NextResponse.json(
        { error: "Failed to create workspace. Is the backend running?" },
        { status: 502 },
      );
    }
    const workspace = (await createRes.json()) as {
      id: string;
      name: string;
      tier: string;
    };

    await supabase.from("workspaces").upsert(
      { id: workspace.id, name: workspace.name },
      { onConflict: "id" },
    );
    await supabase.from("profiles").upsert(
      { id: userId, email },
      { onConflict: "id" },
    );
    const { error: memberError } = await supabase.from("workspace_members").insert({
      user_id: userId,
      workspace_id: workspace.id,
      role: "admin",
    });
    if (memberError) {
      console.error("[signup] workspace_members insert:", memberError);
      return NextResponse.json(
        { error: "Failed to link workspace. Run docs/supabase-tables.sql in Supabase." },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("[signup]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
