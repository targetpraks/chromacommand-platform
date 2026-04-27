"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { AlertTriangle, Bell, Plus, Trash2, Power, PlayCircle } from "lucide-react";

export default function AlertsPage() {
  const utils = trpc.useUtils();
  const rules = trpc.alerts.listRules.useQuery();
  const events = trpc.alerts.recentEvents.useQuery({ limit: 50 });
  const summary = trpc.alerts.summary.useQuery({ hours: 24 });
  const create = trpc.alerts.createRule.useMutation({ onSuccess: () => utils.alerts.listRules.invalidate() });
  const update = trpc.alerts.updateRule.useMutation({ onSuccess: () => utils.alerts.listRules.invalidate() });
  const remove = trpc.alerts.deleteRule.useMutation({ onSuccess: () => utils.alerts.listRules.invalidate() });
  const evalNow = trpc.alerts.evalNow.useMutation({ onSuccess: () => { utils.alerts.recentEvents.invalidate(); utils.alerts.summary.invalidate(); } });

  const [form, setForm] = useState({
    name: "",
    metric: "temperature",
    comparator: ">" as ">" | "<" | ">=" | "<=" | "==",
    threshold: 5.0,
    sustainedMinutes: 10,
    scope: "global" as "global" | "region" | "store",
    targetId: "all",
    severity: "warning" as "info" | "warning" | "critical",
    webhookUrl: "",
    cooldownMinutes: 15,
    description: "",
  });
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-7 h-7 text-[#C8A951]" />
          <div>
            <h1 className="text-2xl font-semibold">Alerts</h1>
            <p className="text-sm text-zinc-400">Threshold rules over telemetry. Slack/Teams webhooks supported.</p>
          </div>
        </div>
        <button onClick={() => evalNow.mutate()} disabled={evalNow.isPending} className="flex items-center gap-2 px-3 py-2 text-sm rounded bg-[#1F2230] hover:bg-[#2A2D3A] disabled:opacity-50">
          <PlayCircle className="w-4 h-4" />
          {evalNow.isPending ? "Evaluating…" : "Eval now"}
        </button>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-4">
        {(summary.data ?? []).map((s: any) => (
          <div key={s.severity} className="rounded-lg border border-[#1F2230] bg-[#11131C] p-4">
            <div className="text-xs text-zinc-500 uppercase">{s.severity}</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{s.fired}</div>
            <div className="text-xs text-zinc-400 mt-1">{s.active} active · {s.resolved} resolved (24h)</div>
          </div>
        ))}
        {(summary.data?.length ?? 0) === 0 && <div className="col-span-3 text-zinc-500 text-sm">No alerts in the last 24h.</div>}
      </section>

      <section className="mb-8 rounded-lg border border-[#1F2230] bg-[#11131C] p-5">
        <h2 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New alert rule
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await create.mutateAsync({
                ...form,
                webhookUrl: form.webhookUrl.trim() || undefined,
                description: form.description.trim() || undefined,
                active: true,
              });
              setForm({ ...form, name: "", description: "" });
            } catch (ex: any) {
              setErr(ex?.message ?? "Create failed");
            }
          }}
          className="grid grid-cols-3 gap-3 text-sm"
        >
          <input placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-3 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" required />
          <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            <option value="temperature">temperature</option>
            <option value="footfall">footfall</option>
            <option value="impressions">impressions</option>
            <option value="qr_scan">qr_scan</option>
            <option value="queue_minutes">queue_minutes</option>
          </select>
          <select value={form.comparator} onChange={(e) => setForm({ ...form, comparator: e.target.value as any })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            <option value=">">&gt;</option><option value="<">&lt;</option><option value=">=">≥</option><option value="<=">≤</option><option value="==">=</option>
          </select>
          <input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" placeholder="threshold" />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as any })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            <option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option>
          </select>
          <input type="number" value={form.sustainedMinutes} onChange={(e) => setForm({ ...form, sustainedMinutes: Number(e.target.value) })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" placeholder="sustained min" />
          <input type="number" value={form.cooldownMinutes} onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" placeholder="cooldown min" />
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            <option value="global">Global</option><option value="region">Region</option><option value="store">Store</option>
          </select>
          <input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} className="col-span-2 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" placeholder="target id (or 'all' for global)" />
          <input value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} className="col-span-3 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" placeholder="Slack/Teams webhook URL (optional)" />
          {err && <div className="col-span-3 text-red-400 text-sm">{err}</div>}
          <button type="submit" disabled={create.isPending} className="col-span-3 rounded bg-[#C8A951] hover:bg-[#D4B669] text-black font-medium py-2 disabled:opacity-50">{create.isPending ? "Saving…" : "Create rule"}</button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border border-[#1F2230] bg-[#11131C]">
        <header className="px-4 py-3 border-b border-[#1F2230] text-sm font-medium text-zinc-200">Active rules</header>
        <ul className="divide-y divide-[#1F2230]">
          {(rules.data ?? []).map((r: any) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100">{r.name} <span className="text-xs text-zinc-500">· {r.severity}</span></div>
                <div className="text-xs text-zinc-500">
                  <code className="text-zinc-400">{r.metric} {r.comparator} {r.threshold}</code> for {r.sustainedMinutes}m · {r.scope}:{r.targetId} · cd {r.cooldownMinutes}m
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => update.mutate({ id: r.id, patch: { active: !r.active } })} className="text-xs px-2 py-1 rounded border border-[#2A2D3A] hover:bg-[#1A1D28] flex items-center gap-1">
                  <Power className="w-3 h-3" /> {r.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) remove.mutate({ id: r.id }); }} className="text-xs px-2 py-1 rounded border border-[#2A2D3A] hover:bg-red-900/30 hover:border-red-700 text-red-300 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </li>
          ))}
          {rules.data?.length === 0 && <li className="px-4 py-8 text-center text-zinc-500 text-sm">No rules — create one above.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-[#1F2230] bg-[#11131C]">
        <header className="px-4 py-3 border-b border-[#1F2230] text-sm font-medium text-zinc-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Recent events (last 50)
        </header>
        <ul className="divide-y divide-[#1F2230]">
          {(events.data ?? []).map((e: any) => (
            <li key={e.id} className="px-4 py-3 flex items-center justify-between">
              <div className="text-sm">
                <div className={`flex items-center gap-2 ${e.severity === "critical" ? "text-red-300" : e.severity === "warning" ? "text-amber-300" : "text-zinc-200"}`}>
                  <AlertTriangle className="w-3.5 h-3.5" /> {e.message}
                </div>
                <div className="text-xs text-zinc-500">{e.storeId} · fired {new Date(e.firedAt).toLocaleString()}{e.resolvedAt ? ` · resolved ${new Date(e.resolvedAt).toLocaleString()}` : " · still active"}</div>
              </div>
            </li>
          ))}
          {events.data?.length === 0 && <li className="px-4 py-8 text-center text-zinc-500 text-sm">No alert events recorded.</li>}
        </ul>
      </section>
    </div>
  );
}
