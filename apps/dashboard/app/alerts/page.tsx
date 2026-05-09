"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { AlertTriangle, Bell, Plus, Trash2, Power, PlayCircle, CheckCircle2 } from "lucide-react";
import { Section, SectionHeader, Button, Input, Select, Badge } from "../components/ui";

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
          <Bell className="w-7 h-7 text-gold" />
          <div>
            <h1 className="text-2xl font-semibold">Alerts</h1>
            <p className="text-sm text-on-surface-dim">Threshold rules over telemetry. Slack/Teams webhooks supported.</p>
          </div>
        </div>
        <Button onClick={() => evalNow.mutate()} disabled={evalNow.isPending} className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4" />
          {evalNow.isPending ? "Evaluating…" : "Eval now"}
        </Button>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-4">
        {(summary.data ?? []).map((s: any) => (
          <div key={s.severity} className="cc-card-static !bg-overlay !border-border-medium">
            <div className="text-xs text-on-surface-dim uppercase">{s.severity}</div>
            <div className="text-2xl font-semibold text-on-surface mt-1">{s.fired}</div>
            <div className="text-xs text-on-surface-dim mt-1">{s.active} active · {s.resolved} resolved (24h)</div>
          </div>
        ))}
        {(summary.data?.length ?? 0) === 0 && <div className="col-span-3 text-on-surface-dim text-sm">No alerts in the last 24h.</div>}
      </section>

      <Section className="mb-8 p-5">
        <h2 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
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
          <input placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-3 cc-input" required />

          <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="cc-input">
            <option value="temperature">temperature</option>
            <option value="footfall">footfall</option>
            <option value="impressions">impressions</option>
            <option value="qr_scan">qr_scan</option>
            <option value="queue_minutes">queue_minutes</option>
          </select>
          <select value={form.comparator} onChange={(e) => setForm({ ...form, comparator: e.target.value as any })} className="cc-input">
            <option value=">">&gt;</option><option value="<">&lt;</option><option value=">=">≥</option><option value="<=">≤</option><option value="==">=</option>
          </select>
          <input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} className="cc-input" placeholder="threshold" />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as any })} className="cc-input">
            <option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option>
          </select>
          <input type="number" value={form.sustainedMinutes} onChange={(e) => setForm({ ...form, sustainedMinutes: Number(e.target.value) })} className="cc-input" placeholder="sustained min" />
          <input type="number" value={form.cooldownMinutes} onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })} className="cc-input" placeholder="cooldown min" />
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any })} className="cc-input">
            <option value="global">Global</option><option value="region">Region</option><option value="store">Store</option>
          </select>
          <input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} className="col-span-2 cc-input" placeholder="target id (or 'all' for global)" />
          <input value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} className="col-span-3 cc-input" placeholder="Slack/Teams webhook URL (optional)" />
          {err && <div className="col-span-3 text-error text-sm">{err}</div>}
          <Button variant="primary" size="md" type="submit" disabled={create.isPending} className="col-span-3">
            {create.isPending ? "Saving…" : "Create rule"}
          </Button>
        </form>
      </Section>

      <Section className="mb-8">
        <SectionHeader>Active rules <span className="text-xs text-on-surface-dim ml-2">{rules.data?.length ?? 0} total</span></SectionHeader>
        <ul>
          {(rules.data ?? []).map((r: any) => (
            <li key={r.id} className="cc-list-item cc-divider">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-on-dark flex items-center gap-2">
                  {r.active ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <span className="w-3.5 h-3.5 rounded-full bg-on-surface-dim" />}
                  {r.name} <Badge variant={r.severity === "critical" ? "error" : r.severity === "warning" ? "warning" : "info"}>{r.severity}</Badge>
                </div>
                <div className="text-xs text-on-surface-dim">
                  <code className="text-on-surface">{r.metric} {r.comparator} {r.threshold}</code> for {r.sustainedMinutes}m · {r.scope}:{r.targetId} · cd {r.cooldownMinutes}m
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => update.mutate({ id: r.id, patch: { active: !r.active } })} className="flex items-center gap-1">
                  <Power className="w-3 h-3" /> {r.active ? "Active" : "Paused"}
                </Button>
                <Button
                  variant="danger-ghost"
                  onClick={() => { if (confirm(`Delete "${r.name}"?`)) remove.mutate({ id: r.id }); }}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              </div>
            </li>
          ))}
          {rules.data?.length === 0 && <li className="px-4 py-8 text-center text-on-surface-dim text-sm">No rules — create one above.</li>}
        </ul>
      </Section>

      <Section>
        <SectionHeader>
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Recent events (last 50)</span>
        </SectionHeader>
        <ul>
          {(events.data ?? []).map((e: any) => (
            <li key={e.id} className="cc-list-item cc-divider">
              <div className="text-sm">
                <div className={`flex items-center gap-2 ${e.severity === "critical" ? "text-red-300" : e.severity === "warning" ? "text-warning" : "text-on-surface"}`}>
                  <AlertTriangle className="w-3.5 h-3.5" /> {e.message}
                </div>
                <div className="text-xs text-on-surface-dim">{e.storeId} · fired {new Date(e.firedAt).toLocaleString()}{e.resolvedAt ? ` · resolved ${new Date(e.resolvedAt).toLocaleString()}` : " · still active"}</div>
              </div>
            </li>
          ))}
          {events.data?.length === 0 && <li className="px-4 py-8 text-center text-on-surface-dim text-sm">No alert events recorded.</li>}
        </ul>
      </Section>
    </div>
  );
}