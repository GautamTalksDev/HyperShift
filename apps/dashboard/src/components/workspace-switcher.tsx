"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Users, Loader2 } from "lucide-react";

interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
}

export function WorkspaceSwitcher() {
  const { data: session, status, update } = useSession();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: { workspaces?: WorkspaceItem[] }) =>
        setWorkspaces(data.workspaces ?? []),
      )
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [status]);

  const currentId = session?.workspaceId;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id || id === currentId) return;
    const w = workspaces.find((x) => x.id === id);
    if (w) {
      await update({ workspaceId: id, role: w.role });
      window.location.reload();
    }
  }

  if (status !== "authenticated" || workspaces.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <select
        value={currentId ?? ""}
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
