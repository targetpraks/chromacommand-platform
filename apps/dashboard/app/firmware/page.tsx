"use client";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import {
  Cpu,
  Upload,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Section, SectionHeader, Button, Badge, StatusDot } from "../components/ui";

const DEVICE_CLASSES = ["led_controller", "screen_player", "audio_player", "gateway"] as const;

type ArtifactStatus = "active" | "rolled-back" | "deprecated";

type ArtifactRow = {
  id: string;
  version: string;
  releasedAt: Date | string | null;
  deviceClass: string;
  status: ArtifactStatus;
  signed: boolean;
};

const STATUS_META: Record<
  ArtifactStatus,
  { variant: "success" | "warning" | "error"; icon: React.ReactNode }
> = {
  active: { variant: "success", icon: <StatusDot status="online" className="!bg-success" /> },
  "rolled-back": { variant: "warning", icon: <StatusDot status="offline" className="!bg-warning" /> },
  deprecated: { variant: "error", icon: <StatusDot status="offline" className="!bg-error opacity-60" /> },
};

export default function FirmwarePage() {
  const utils = trpc.useUtils();
  const releases = trpc.firmware.listReleases.useQuery(undefined as any);
  const deployments = trpc.firmware.listDeployments.useQuery(undefined as any);
  const create = trpc.firmware.createRelease.useMutation({
    onSuccess: () => utils.firmware.listReleases.invalidate(),
  });
  const deploy = trpc.firmware.deploy.useMutation({
    onSuccess: () => utils.firmware.listDeployments.invalidate(),
  });

  const [form, setForm] = useState({
    deviceClass: "led_controller" as (typeof DEVICE_CLASSES)[number],
    version: "",
    url: "",
    sha256: "",
    notes: "",
  });
  const [deployForm, setDeployForm] = useState({
    releaseId: "",
    scope: "store" as "store" | "region" | "global",
    targetId: "pp-a01",
  });
  const [err, setErr] = useState<string | null>(null);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);

  const artifacts: ArtifactRow[] = (releases.data ?? []).map((r: any) => ({
    id: r.id,
    version: r.version,
    releasedAt: r.releasedAt,
    deviceClass: r.deviceClass,
    // Stub: treat the latest per deviceClass as active, earlier as deprecated.
    // In production this would come from DB status column.
    status: "active" as ArtifactStatus,
    // Stub: deterministic signing indicator based on sha256 presence/length.
    signed: !!r.sha256 && r.sha256.length === 64,
  }));

  const handleRollback = (version: string) => {
    // eslint-disable-next-line no-console
    console.log(`Rollback to v${version} requested`);
  };

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8 flex items-center gap-3">
        <Cpu className="w-7 h-7 text-gold" />
        <div>
          <h1 className="text-2xl font-semibold">Firmware OTA</h1>
          <p className="text-sm text-on-surface-dim">
            Artifact versions, rollouts, and per-device install status.
          </p>
        </div>
      </header>

      {/* Upload new firmware form stub */}
      <Section className="mb-8 p-5">
        <h2 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload new firmware artifact
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
          <select
            value={form.deviceClass}
            onChange={(e) => setForm({ ...form, deviceClass: e.target.value as any })}
            className="cc-input"
          >
            {DEVICE_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            placeholder="Version (e.g. 1.2.3)"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            className="cc-input"
          />
          <input
            placeholder="CDN URL (signed)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="col-span-2 cc-input"
          />
          <input
            placeholder="SHA-256 (64-char hex)"
            value={form.sha256}
            onChange={(e) => setForm({ ...form, sha256: e.target.value })}
            className="col-span-2 cc-input font-mono text-xs"
          />
          <textarea
            placeholder="Release notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="col-span-2 cc-input"
            rows={2}
          />
          {err && <div className="col-span-2 text-error text-sm">{err}</div>}
          <Button variant="primary" size="md" type="submit" disabled={create.isPending} className="col-span-2">
            {create.isPending ? "Saving…" : "Register release"}
          </Button>
        </form>
      </Section>

      {/* Firmware artifact version table */}
      <Section className="mb-8">
        <SectionHeader>
          <span className="flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Artifacts
          </span>
        </SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel border-b border-border-medium">
              <tr className="text-left text-xs text-on-dark-secondary uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Device Class</th>
                <th className="px-4 py-3 font-medium">Released</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Signing</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-on-surface-dim text-sm">
                    No artifacts yet.
                  </td>
                </tr>
              )}
              {artifacts.map((a) => {
                const meta = STATUS_META[a.status];
                const isExpanded = expandedArtifactId === a.id;
                return (
                  <>
                    <tr
                      key={a.id}
                      className="border-b border-border-subtle hover:bg-panel-hover transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-on-dark">v{a.version}</span>
                          <button
                            className="text-on-dark-secondary hover:text-gold"
                            onClick={() => setExpandedArtifactId(isExpanded ? null : a.id)}
                            aria-label="Toggle details"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface capitalize">{a.deviceClass.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-on-surface-dim">
                        {a.releasedAt ? new Date(a.releasedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {meta.icon}
                          <Badge variant={meta.variant}>
                            {a.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.signed ? (
                          <div className="flex items-center gap-1 text-success font-medium">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-xs">Signed ✓</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-warning font-medium">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs">Unsigned ⚠</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => handleRollback(a.version)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Rollback
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-panel-hover/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="text-xs text-on-dark-secondary space-y-1">
                            <div className="grid grid-cols-1 gap-1">
                              <span>
                                <span className="text-on-surface-dim">Artifact ID:</span> {a.id}
                              </span>
                              <span>
                                <span className="text-on-surface-dim">Device Class:</span> {a.deviceClass}
                              </span>
                              <span>
                                <span className="text-on-surface-dim">Status:</span>{" "}
                                {a.status === "active"
                                  ? "Active — eligible for deployment"
                                  : a.status === "rolled-back"
                                  ? "Rolled back — do not deploy"
                                  : "Deprecated — superseded by newer build"}
                              </span>
                              <span>
                                <span className="text-on-surface-dim">Signing:</span>{" "}
                                {a.signed
                                  ? "SHA-256 digest present. Signature verification stub."
                                  : "Unsigned — verify provenance before flashing."}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section className="mb-8">
        <SectionHeader>
          <span className="flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Deploy a release
          </span>
        </SectionHeader>
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
          <select
            value={deployForm.releaseId}
            onChange={(e) => setDeployForm({ ...deployForm, releaseId: e.target.value })}
            className="cc-input"
            required
          >
            <option value="">Pick release…</option>
            {(releases.data ?? []).map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.deviceClass} v{r.version}
              </option>
            ))}
          </select>
          <select
            value={deployForm.scope}
            onChange={(e) => setDeployForm({ ...deployForm, scope: e.target.value as any })}
            className="cc-input"
          >
            <option value="store">Store</option>
            <option value="region">Region</option>
            <option value="global">Global</option>
          </select>
          <input
            value={deployForm.targetId}
            onChange={(e) => setDeployForm({ ...deployForm, targetId: e.target.value })}
            placeholder="target id"
            className="cc-input"
          />
          <Button variant="primary" size="md" type="submit" disabled={deploy.isPending} className="col-span-3">
            {deploy.isPending ? "Dispatching…" : "Roll out"}
          </Button>
        </form>
      </Section>

      <Section>
        <SectionHeader>Recent deployments</SectionHeader>
        <ul>
          {(deployments.data ?? []).map((d: any) => (
            <li key={d.id} className="cc-list-item cc-divider">
              <div className="text-sm">
                <div className="text-on-dark flex items-center gap-2">
                  {d.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : d.status === "failed" ? (
                    <AlertTriangle className="w-4 h-4 text-error" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-warning" />
                  )}
                  {d.scope}:{d.targetId} → {d.successCount}/{d.totalDevices} success,{" "}
                  {d.failureCount} failed
                </div>
                <div className="text-xs text-on-surface-dim">
                  {new Date(d.startedAt).toLocaleString()} · status {d.status}
                </div>
              </div>
            </li>
          ))}
          {(deployments.data?.length ?? 0) === 0 && (
            <li className="px-4 py-8 text-center text-on-surface-dim text-sm">No deployments yet.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}
