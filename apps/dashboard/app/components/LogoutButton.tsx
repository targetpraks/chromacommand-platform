"use client";
import { useRouter } from "next/navigation";
import { LogOut, Power } from "lucide-react";
import { trpc, setToken } from "../lib/trpc";

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
      /* token might be invalid; clearing locally is enough */
    }
    setToken(null);
    router.push("/login");
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded border border-[#1F2230] bg-[#0A0B14]">
      <div>
        <div className="text-sm text-zinc-100">{me.data?.email ?? "—"}</div>
        <div className="text-xs text-zinc-500">{me.data?.role ?? "—"}</div>
      </div>
      <button
        onClick={handle}
        disabled={logout.isPending || logoutAll.isPending}
        className="flex items-center gap-2 text-xs px-3 py-2 rounded bg-[#1F2230] hover:bg-red-900/30 hover:text-red-300 disabled:opacity-50"
      >
        {all ? <Power className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
        {all ? "Sign out everywhere" : "Sign out"}
      </button>
    </div>
  );
}
