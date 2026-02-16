/**
 * Simple mock auth for the dashboard. Session is stored in localStorage.
 * Replace with Supabase Auth or another provider by implementing the same interface.
 */

const SESSION_KEY = "hypershift_session";

export type Role = "viewer" | "operator" | "admin";

export interface Session {
  email: string;
  createdAt: string;
  role?: Role;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setSession(email: string, role?: Role): void {
  if (typeof window === "undefined") return;
  const session: Session = {
    email,
    createdAt: new Date().toISOString(),
    role: role ?? "operator",
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

/** Any stakeholder (viewer, operator, admin) can approve or reject a pipeline run. */
export function canApproveReject(_role?: Role): boolean {
  return true;
}

export function canStartRun(role?: Role): boolean {
  return role === "admin" || role === "operator" || role === undefined;
}

export function isViewerOnly(role?: Role): boolean {
  return role === "viewer";
}
