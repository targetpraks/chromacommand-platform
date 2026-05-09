"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc, setToken } from "../lib/trpc";
import { Button, Input } from "../components/ui";

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
    <div className="min-h-screen flex items-center justify-center bg-dark text-on-dark">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-panel border border-border-medium">
        <h1 className="text-2xl font-semibold text-gold">ChromaCommand</h1>
        <p className="text-sm text-on-surface-dim">Sign in to the operator console.</p>

        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />

        <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        <span className="text-xs text-on-surface-dim">Dev mode: any password works for seeded users.</span>

        <div className="space-y-1">
          <span className="text-xs text-on-surface-dim">Quick fill:</span>
          <div className="flex flex-wrap gap-1">
            {presetUsers.map((u) => (
              <button
                type="button"
                key={u.email}
                onClick={() => setEmail(u.email)}
                className="text-xs px-2 py-1 rounded bg-panel-hover border border-border-strong text-on-surface hover:text-on-dark hover:bg-overlay transition"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="text-error text-sm">{err}</div>}

        <Button variant="primary" size="md" type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}