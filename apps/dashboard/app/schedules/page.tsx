"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Calendar, Trash2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

const COMMON_CRONS = [
  { label: "Weekday 06:00 (Morning Open)", expr: "0 6 * * 1-5" },
  { label: "Daily 22:00 (Late Night dim)", expr: "0 22 * * *" },
  { label: "Weekend 18:00 (Saturday Night)", expr: "0 18 * * 6,0" },
  { label: "Every hour, on the hour", expr: "0 * * * *" },
];

export default function SchedulesPage() {
  const utils = trpc.useUtils();
  const list = trpc.schedules.list.useQuery();
  const presets = trpc.rgb.listPresets.useQuery();
  const create = trpc.schedules.create.useMutation({ onSuccess: () => utils.schedules.list.invalidate() });
  const remove = trpc.schedules.remove.useMutation({ onSuccess: () => utils.schedules.list.invalidate() });
  const update = trpc.schedules.update.useMutation({ onSuccess: () => utils.schedules.list.invalidate() });

  const [form, setForm] = useState({
    name: "",
    presetId: "",
    scope: "store" as "store" | "region" | "global",
    targetId: "pp-a01",
    cronExpression: COMMON_CRONS[0].expr,
    priority: 100,
    active: true,
  });
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await create.mutateAsync({ ...form, timezone: "Africa/Johannesburg" });
      setForm({ ...form, name: "" });
    } catch (ex: any) {
      setErr(ex?.message ?? "Create failed");
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8 flex items-center gap-3">
        <Calendar className="w-7 h-7 text-[#C8A951]" />
        <div>
          <h1 className="text-2xl font-semibold">RGB Schedules</h1>
          <p className="text-sm text-zinc-400">Cron-driven preset transitions across stores and regions.</p>
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-[#1F2230] bg-[#11131C] p-5">
        <h2 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create new schedule
        </h2>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <input
            placeholder="Name (e.g. Morning Open)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2"
            required
          />

          <select
            value={form.presetId}
            onChange={(e) => setForm({ ...form, presetId: e.target.value })}
            className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2"
            required
          >
            <option value="">Select preset…</option>
            {(presets.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={form.cronExpression}
            onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
            className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2"
          >
            {COMMON_CRONS.map((c) => (
              <option key={c.expr} value={c.expr}>{c.label}</option>
            ))}
          </select>

          <select
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as any })}
            className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2"
          >
            <option value="store">Single store</option>
            <option value="region">Whole region</option>
            <option value="global">Network-wide</option>
          </select>

          <input
            placeholder={form.scope === "global" ? "all" : form.scope === "region" ? "cape-town" : "pp-a01"}
            value={form.scope === "global" ? "all" : form.targetId}
            onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            disabled={form.scope === "global"}
            className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2 disabled:opacity-50"
          />

          <div className="col-span-2 flex items-center gap-3">
            <label className="text-zinc-400 flex items-center gap-2">
              Priority
              <input
                type="number"
                min={0}
                max={1000}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-20 rounded bg-[#0A0B14] border border-[#1F2230] px-2 py-1"
              />
            </label>
            <span className="text-xs text-zinc-500">Higher priority overrides lower-priority schedules on the same target.</span>
          </div>

          {err && (
            <div className="col-span-2 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {err}
            </div>
          )}

          <button
            type="submit"
            disabled={create.isPending}
            className="col-span-2 rounded bg-[#C8A951] hover:bg-[#D4B669] text-black font-medium py-2 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create schedule"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[#1F2230] bg-[#11131C]">
        <header className="px-4 py-3 border-b border-[#1F2230] flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">Active schedules</h2>
          <span className="text-xs text-zinc-500">{list.data?.length ?? 0} total</span>
        </header>
        <ul className="divide-y divide-[#1F2230]">
          {(list.data ?? []).map((s: any) => (
            <li key={s.id} className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100 flex items-center gap-2">
                  {s.active ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3.5 h-3.5 rounded-full bg-zinc-700" />}
                  {s.name}
                </div>
                <div className="text-xs text-zinc-500">
                  <code className="text-zinc-400">{s.cronExpression}</code> · {s.scope}:{s.targetId} · priority {s.priority} · {s.timezone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update.mutate({ id: s.id, active: !s.active })}
                  className="text-xs px-2 py-1 rounded border border-[#2A2D3A] hover:bg-[#1A1D28]"
                >
                  {s.active ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete schedule "${s.name}"?`)) remove.mutate({ id: s.id });
                  }}
                  className="text-xs px-2 py-1 rounded border border-[#2A2D3A] hover:bg-red-900/30 hover:border-red-700 text-red-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </li>
          ))}
          {list.data?.length === 0 && (
            <li className="px-4 py-8 text-center text-zinc-500 text-sm">No schedules yet — create one above.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
