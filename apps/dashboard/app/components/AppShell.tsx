"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { AuthGate } from "./AuthGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <AuthGate>
      {isLogin ? (
        <main className="min-h-screen">{children}</main>
      ) : (
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-[240px] min-h-screen">{children}</main>
        </div>
      )}
    </AuthGate>
  );
}
