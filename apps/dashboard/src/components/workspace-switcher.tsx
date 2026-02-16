"use client";

import { Users, Loader2 } from "lucide-react";
import { useAuth } from "@/components/supabase-auth-provider";

export function WorkspaceSwitcher() {
  const { user, workspaces, workspaceId, setWorkspaceId, loading } = useAuth();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id || id === workspaceId) return;
    setWorkspaceId(id);
  }

  if (!user || workspaces.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <select
        value={workspaceId ?? ""}
        onChange={handleChange}
        className="rounded-md border bg-background px-2 py-1.5 text-sm min-w-[120px] max-w-[180px] truncate"
        title="Switch workspace"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
