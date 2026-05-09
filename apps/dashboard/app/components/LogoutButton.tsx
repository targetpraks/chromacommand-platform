"use client";
import { useRouter } from "next/navigation";
import { LogOut, Power } from "lucide-react";
import { trpc, setToken } from "../lib/trpc";
import { Card } from "./ui";

export function LogoutButton({ all = false }: { all?: boolean }) {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const logout = trpc.auth.logout.useMutation();
  const logoutAll = trpc.auth.logoutAll.useMutation();

  async function handle() {
    try {
      if (all) await logoutAll.mutateAsync();
      else await logout.mutateAsync({ refreshToken: undefined });
    } catch {
      /* token might be invalid */
    }
    setToken(null);
    router.push("/login");
  }

  return (
    <div className="cc-card-static flex items-center justify-between gap-3 !p-3 !rounded-lg border-border-medium">
      <div>
        <div className="text-sm text-on-dark">{me.data?.email ?? "—"}</div>
        <div className="text-xs text-on-surface-dim">{me.data?.role ?? "—"}</div>
      </div>
      <button
        onClick={handle}
        disabled={logout.isPending || logoutAll.isPending}
        className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-panel-hover border border-border-strong hover:bg-error-subtle hover:text-red-300 hover:border-red-700 transition disabled:opacity-50"
      >
        {all ? <Power className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
        {all ? "Sign out everywhere" : "Sign out"}
      </button>
    </div>
  );
}