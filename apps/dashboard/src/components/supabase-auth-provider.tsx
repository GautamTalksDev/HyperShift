"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type WorkspaceItem = { id: string; name: string; role: string };

type AuthContextValue = {
  user: User | null;
  workspaceId: string | null;
  role: string | null;
  workspaces: WorkspaceItem[];
  setWorkspaceId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const WORKSPACE_COOKIE = "hypershift_workspace_id";

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchWorkspaces = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setWorkspaces([]);
      setWorkspaceIdState(null);
      setRole(null);
      return;
    }
    try {
      const res = await fetch("/api/workspaces");
      const data = await res.json();
      const list = (data.workspaces ?? []) as WorkspaceItem[];
      setWorkspaces(list);
      if (list.length > 0 && !workspaceId) {
        const fromCookie = typeof document !== "undefined" && document.cookie
          .split("; ")
          .find((r) => r.startsWith(`${WORKSPACE_COOKIE}=`))
          ?.split("=")[1];
        const chosen = fromCookie && list.some((w) => w.id === fromCookie)
          ? fromCookie
          : list[0].id;
        const w = list.find((x) => x.id === chosen);
        setWorkspaceIdState(chosen);
        setRole(w?.role ?? null);
      }
    } catch {
      setWorkspaces([]);
    }
  }, [supabase.auth, workspaceId]);

  const setWorkspaceId = useCallback((id: string) => {
    setWorkspaceIdState(id);
    const w = workspaces.find((x) => x.id === id);
    setRole(w?.role ?? null);
    document.cookie = `${WORKSPACE_COOKIE}=${id}; path=/; max-age=31536000`;
    window.location.reload();
  }, [workspaces]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchWorkspaces();
        } else {
          setWorkspaces([]);
          setWorkspaceIdState(null);
          setRole(null);
        }
        setLoading(false);
      },
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchWorkspaces().then(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth, fetchWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0 && !workspaceId) {
      const fromCookie = typeof document !== "undefined" && document.cookie
        .split("; ")
        .find((r) => r.startsWith(`${WORKSPACE_COOKIE}=`))
        ?.split("=")[1];
      const chosen = fromCookie && workspaces.some((w) => w.id === fromCookie)
        ? fromCookie
        : workspaces[0].id;
      const w = workspaces.find((x) => x.id === chosen);
      setWorkspaceIdState(chosen);
      setRole(w?.role ?? null);
    }
  }, [workspaces, workspaceId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaceId,
        role,
        workspaces,
        setWorkspaceId,
        loading,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within SupabaseAuthProvider");
  return ctx;
}
