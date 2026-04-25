"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc, setToken } from "../lib/trpc";

const presetUsers = [
  { label: "HQ Admin (Ricardo)", email: "ricardo@infxmedia.co.za" },
  { label: "Cape Town RM", email: "regional.cpt@papapasta.co.za" },
  { label: "PP-A01 Franchisee", email: "franchisee.a01@papapasta.co.za" },
  { label: "MTN Sponsor", email: "marketing@mtn.co.za" },
  { label: "Field Tech", email: "tech@infxmedia.co.za" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(presetUsers[0].email);
  const [password, setPassword] = useState("dev");
  const [err, setErr] = useState<string | null>(null);
  const login = trpc.auth.login.useMutation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await login.mutateAsync({ email, password });
      setToken(res.token);
      router.push("/");
    } catch (ex: any) {
      setErr(ex?.message ?? "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0B14] text-white">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-6 rounded-lg bg-[#11131C] border border-[#1F2230]">
        <h1 className="text-2xl font-semibold text-[#C8A951]">ChromaCommand</h1>
        <p className="text-sm text-zinc-400">Sign in to the operator console.</p>

        <label className="block text-sm">
          <span className="text-zinc-300">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2 text-white"
            type="email"
          />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-300">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2 text-white"
            type="password"
          />
          <span className="text-xs text-zinc-500">Dev mode: any password works for seeded users.</span>
        </label>

        <div className="space-y-1">
          <span className="text-xs text-zinc-400">Quick fill:</span>
          <div className="flex flex-wrap gap-1">
            {presetUsers.map((u) => (
              <button
                type="button"
                key={u.email}
                onClick={() => setEmail(u.email)}
                className="text-xs px-2 py-1 rounded bg-[#1F2230] hover:bg-[#2A2D3A] text-zinc-200"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-[#C8A951] hover:bg-[#D4B669] text-black font-medium py-2 disabled:opacity-50"
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
