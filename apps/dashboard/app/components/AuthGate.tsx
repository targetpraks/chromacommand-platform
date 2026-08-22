"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

const PUBLIC_ROUTES = ["/landing", "/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isPublic) return;
    const token = getCookie("cc_access_token");
    if (!token) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router, isPublic]);

  // Public routes (including /login itself) render unconditionally —
  // previously the gate wrapped /login too, deadlocking logged-out users on a spinner.
  if (isPublic) {
    return <>{children}</>;
  }

  if (!checked) {
    return <div className="min-h-screen bg-dark grid place-items-center text-surface-dim"><span>Authenticating…</span></div>;
  }

  return <>{children}</>;
}
