"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Calendar, Trash2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Section, SectionHeader, Button, Input, Badge } from "../components/ui";

const COMMON_CRONS = [
  { label: "Weekday 06:00 (Morning Open)", expr: "0 6 * * 1-5" },
  { label: "Daily 22:00 (Late Night dim)", expr: "0 22 * * *" },
  { label: "Weekend 18:00 (Saturday Night)", expr: "0 18 * * 6,0" },
  { label: "Every hour, on the hour", expr: "0 * * * *" },
];

export default function SchedulesPage() {
  const utils = trpc.useUtils();
  const list = trpc.schedules.list.useQuery(undefined as any);
  const presets = trpc.rgb.listPresets.useQuery(undefined as any);
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
        <Calendar className="w-7 h-7 text-gold" />
        <div>
          <h1 className="text-2xl font-semibold">RGB Schedules</h1>
          <p className="text-sm text-on-surface-dim">Cron-driven preset transitions across stores and regions.</p>
        </div>
      </header>

      <Section className="mb-8 p-5">
        <h2 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create new schedule
        </h2>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <input
            placeholder="Name (e.g. Morning Open)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 cc-input"
            required
          />

          <select value={form.presetId} onChange={(e) => setForm({ ...form, presetId: e.target.value })} className="cc-input" required>
            <option value="">Select preset…</option>
            {(presets.data ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select value={form.cronExpression} onChange={(e) => setForm({ ...form, cronExpression: e.target.value })} className="cc-input">
            {COMMON_CRONS.map((c) => (
              <option key={c.expr} value={c.expr}>{c.label}</option>
            ))}
          </select>

          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })} className="cc-input">
            <option value="store">Single store</option>
            <option value="region">Whole region</option>
            <option value="global">Network-wide</option>
          </select>

          <input
            placeholder={form.scope === "global" ? "all" : form.scope === "region" ? "cape-town" : "pp-a01"}
            value={form.scope === "global" ? "all" : form.targetId}
            onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            disabled={form.scope === "global"}
            className="cc-input disabled:opacity-50"
          />

          <div className="col-span-2 flex items-center gap-3">
            <label className="text-on-surface-dim flex items-center gap-2">
              Priority
              <input
                type="number"
                min={0}
                max={1000}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-20 cc-input"
              />
            </label>
            <span className="text-xs text-on-surface-dim">Higher priority overrides lower-priority schedules on the same target.</span>
          </div>

          {err && (
            <div className="col-span-2 text-error text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {err}
            </div>
          )}

          <Button variant="primary" size="md" type="submit" disabled={create.isPending} className="col-span-2">
            {create.isPending ? "Creating…" : "Create schedule"}
          </Button>
        </form>
      </Section>

      <Section>
        <SectionHeader>
          Active schedules
          <span className="text-xs text-on-surface-dim">{list.data?.length ?? 0} total</span>
        </SectionHeader>
        <ul>
          {(list.data ?? []).map((s: any) => (
            <li key={s.id} className="cc-list-item cc-divider">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-on-dark flex items-center gap-2">
                  {s.active ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <span className="w-3.5 h-3.5 rounded-full bg-on-surface-dim" />}
                  {s.name}
                </div>
                <div className="text-xs text-on-surface-dim">
                  <code className="text-on-surface">{s.cronExpression}</code> · {s.scope}:{s.targetId} · priority {s.priority} · {s.timezone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => update.mutate({ id: s.id, active: !s.active })}>
                  {s.active ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="danger-ghost"
                  onClick={() => { if (confirm(`Delete schedule "${s.name}"?`)) remove.mutate({ id: s.id }); }}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </li>
          ))}
          {list.data?.length === 0 && <li className="px-4 py-8 text-center text-on-surface-dim text-sm">No schedules yet — create one above.</li>}
        </ul>
      </Section>
    </div>
  );
}