"use client";
import { Sidebar } from "./Sidebar";
import { AuthGate } from "./AuthGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-[240px] min-h-screen">{children}</main>
      </div>
    </AuthGate>
  );
}
