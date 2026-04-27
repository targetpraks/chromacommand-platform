"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Cpu, Upload, Rocket, CheckCircle2, AlertTriangle } from "lucide-react";

const DEVICE_CLASSES = ["led_controller", "screen_player", "audio_player", "gateway"] as const;

export default function FirmwarePage() {
  const utils = trpc.useUtils();
  const releases = trpc.firmware.listReleases.useQuery();
  const deployments = trpc.firmware.listDeployments.useQuery();
  const create = trpc.firmware.createRelease.useMutation({ onSuccess: () => utils.firmware.listReleases.invalidate() });
  const deploy = trpc.firmware.deploy.useMutation({ onSuccess: () => utils.firmware.listDeployments.invalidate() });

  const [form, setForm] = useState({
    deviceClass: "led_controller" as (typeof DEVICE_CLASSES)[number],
    version: "",
    url: "",
    sha256: "",
    notes: "",
  });
  const [deployForm, setDeployForm] = useState({ releaseId: "", scope: "store" as "store" | "region" | "global", targetId: "pp-a01" });
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8 flex items-center gap-3">
        <Cpu className="w-7 h-7 text-[#C8A951]" />
        <div>
          <h1 className="text-2xl font-semibold">Firmware OTA</h1>
          <p className="text-sm text-zinc-400">Releases, rollouts, and per-device install status.</p>
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-[#1F2230] bg-[#11131C] p-5">
        <h2 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Register a new release
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await create.mutateAsync(form);
              setForm({ ...form, version: "", url: "", sha256: "", notes: "" });
            } catch (ex: any) {
              setErr(ex?.message ?? "Create failed");
            }
          }}
          className="grid grid-cols-2 gap-3 text-sm"
        >
          <select value={form.deviceClass} onChange={(e) => setForm({ ...form, deviceClass: e.target.value as any })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            {DEVICE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Version (e.g. 1.2.3)" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" />
          <input placeholder="CDN URL (signed)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="col-span-2 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" />
          <input placeholder="SHA-256 (64-char hex)" value={form.sha256} onChange={(e) => setForm({ ...form, sha256: e.target.value })} className="col-span-2 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2 font-mono text-xs" />
          <textarea placeholder="Release notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="col-span-2 rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" rows={2} />
          {err && <div className="col-span-2 text-red-400 text-sm">{err}</div>}
          <button type="submit" disabled={create.isPending} className="col-span-2 rounded bg-[#C8A951] hover:bg-[#D4B669] text-black font-medium py-2 disabled:opacity-50">{create.isPending ? "Saving…" : "Register release"}</button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border border-[#1F2230] bg-[#11131C]">
        <header className="px-4 py-3 border-b border-[#1F2230] text-sm font-medium text-zinc-200 flex items-center gap-2">
          <Rocket className="w-4 h-4" /> Deploy a release
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await deploy.mutateAsync(deployForm);
            } catch (ex: any) {
              setErr(ex?.message ?? "Deploy failed");
            }
          }}
          className="p-4 grid grid-cols-3 gap-3 text-sm"
        >
          <select value={deployForm.releaseId} onChange={(e) => setDeployForm({ ...deployForm, releaseId: e.target.value })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" required>
            <option value="">Pick release…</option>
            {(releases.data ?? []).map((r: any) => (<option key={r.id} value={r.id}>{r.deviceClass} v{r.version}</option>))}
          </select>
          <select value={deployForm.scope} onChange={(e) => setDeployForm({ ...deployForm, scope: e.target.value as any })} className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2">
            <option value="store">Store</option>
            <option value="region">Region</option>
            <option value="global">Global</option>
          </select>
          <input value={deployForm.targetId} onChange={(e) => setDeployForm({ ...deployForm, targetId: e.target.value })} placeholder="target id" className="rounded bg-[#0A0B14] border border-[#1F2230] px-3 py-2" />
          <button type="submit" disabled={deploy.isPending} className="col-span-3 rounded bg-[#C8A951] hover:bg-[#D4B669] text-black font-medium py-2 disabled:opacity-50">{deploy.isPending ? "Dispatching…" : "Roll out"}</button>
        </form>
      </section>

      <section className="rounded-lg border border-[#1F2230] bg-[#11131C]">
        <header className="px-4 py-3 border-b border-[#1F2230] text-sm font-medium text-zinc-200">Recent deployments</header>
        <ul className="divide-y divide-[#1F2230]">
          {(deployments.data ?? []).map((d: any) => (
            <li key={d.id} className="px-4 py-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="text-zinc-100 flex items-center gap-2">
                  {d.status === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   d.status === "failed" ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
                   <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  {d.scope}:{d.targetId} → {d.successCount}/{d.totalDevices} success, {d.failureCount} failed
                </div>
                <div className="text-xs text-zinc-500">{new Date(d.startedAt).toLocaleString()} · status {d.status}</div>
              </div>
            </li>
          ))}
          {(deployments.data?.length ?? 0) === 0 && <li className="px-4 py-8 text-center text-zinc-500 text-sm">No deployments yet.</li>}
        </ul>
      </section>
    </div>
  );
}
