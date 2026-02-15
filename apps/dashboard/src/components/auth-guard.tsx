"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    setChecked(true);
    if (status === "unauthenticated" || !session) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname || "/")}`;
      router.replace(loginUrl);
    }
  }, [router, pathname, session, status]);

  if (
    !checked ||
    status === "loading" ||
    status === "unauthenticated" ||
    !session
  ) {
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
