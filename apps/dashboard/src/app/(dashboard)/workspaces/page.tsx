"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/supabase-auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Loader2, PlusCircle, UserPlus } from "lucide-react";

interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
}

export default function WorkspacesPage() {
  const { user, workspaceId, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: { workspaces?: WorkspaceItem[] }) =>
        setWorkspaces(data.workspaces ?? []),
      )
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workspaces/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = (await res.json()) as {
        id?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to create workspace",
        });
        return;
      }
      setWorkspaces((prev) => [
        ...prev,
        { id: data.id!, name: data.name ?? newName.trim(), role: "admin" },
      ]);
      setNewName("");
      setMessage({
        type: "success",
        text: `Workspace "${data.name}" created. Switch to it using the dropdown in the header.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || inviting || !workspaceId) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          workspaceId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to invite" });
        return;
      }
      setInviteEmail("");
      setMessage({
        type: "success",
        text: "Invitation added. They can switch to this workspace after signing in.",
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setInviting(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-7 w-7" />
          Workspaces & team
        </h1>
        {message && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-green-500/50 bg-green-500/10"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your workspaces</CardTitle>
            <CardDescription>
              Switch workspace using the dropdown in the dashboard header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ul className="space-y-2">
                {workspaces.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="font-medium">{w.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlusCircle className="h-5 w-5" /> Create workspace
            </CardTitle>
            <CardDescription>
              Create a new workspace and get a separate run limit and usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Workspace name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="max-w-xs"
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Invite member
            </CardTitle>
            <CardDescription>
              Add a user to the current workspace by email. They must already
              have an account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-56"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Invite"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
