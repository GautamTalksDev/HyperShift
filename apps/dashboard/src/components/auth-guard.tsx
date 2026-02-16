"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/supabase-auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    setChecked(true);
    if (!user) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname || "/")}`;
      router.replace(loginUrl);
    }
  }, [router, pathname, user, loading]);

  if (!checked || loading || !user) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-background"
        role="status"
        aria-label="Checking authentication"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
