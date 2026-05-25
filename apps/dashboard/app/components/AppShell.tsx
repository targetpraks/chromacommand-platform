"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { AuthGate } from "./AuthGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === "/landing" || pathname.startsWith("/landing/");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 lg:ml-[240px] min-h-screen pt-14 lg:pt-0">{children}</main>
      </div>
    </AuthGate>
  );
}
