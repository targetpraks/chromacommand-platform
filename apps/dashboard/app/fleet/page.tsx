"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Card, Badge, StatusDot, Spinner, Select } from "../components/ui";

const TYPE_LABELS: Record<string, string> = {
  gateway: "Edge Gateway",
  led_controller: "LED Controller",
  screen_player: "Kiosk Player",
  audio_player: "Audio Node",
};

export default function FleetPage() {
  const { data: devices, isLoading } = trpc.stores.fleetDevices.useQuery(undefined, { refetchInterval: 10000 });
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      (devices ?? []).filter(
        (d) => (typeFilter === "all" || d.deviceType === typeFilter) && (statusFilter === "all" || d.status === statusFilter)
      ),
    [devices, typeFilter, statusFilter]
  );

  const counts = useMemo(() => {
    const byType: Record<string, { total: number; online: number }> = {};
    for (const d of devices ?? []) {
      byType[d.deviceType] ??= { total: 0, online: 0 };
      byType[d.deviceType].total++;
      if (d.status === "online") byType[d.deviceType].online++;
    }
    return byType;
  }, [devices]);

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold flex items-center gap-2"><Cpu size={20} /> Device Fleet</h1>
        <p className="text-xs text-on-dark-secondary mt-1">Every controllable endpoint across the network — refreshed live.</p>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const c = counts[type] ?? { total: 0, online: 0 };
          return (
            <Card key={type} className="p-3">
              <p className="text-[11px] text-on-dark-secondary">{label}</p>
              <p className="text-lg font-bold mt-0.5">{c.online}<span className="text-sm text-on-dark-secondary">/{c.total} online</span></p>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <Select value={typeFilter} onChange={(e: any) => setTypeFilter(e.target.value)} options={[{ value: "all", label: "All types" }, ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
        <Select value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)} options={[{ value: "all", label: "Any status" }, { value: "online", label: "Online" }, { value: "offline", label: "Offline" }]} />
      </div>

      <Card className="mt-4 p-0 overflow-hidden">
        {isLoading ? (
          <div className="grid place-items-center py-12"><Spinner /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-on-dark-secondary border-b border-border-medium">
                <th className="px-4 py-2.5">Device</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Store</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Firmware</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Last Seen</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border-medium/50 hover:bg-panel-hover/50 transition">
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium">{d.label}</p>
                    <p className="text-[10px] text-on-dark-secondary font-mono">{d.id}</p>
                  </td>
                  <td className="px-4 py-2.5"><Badge variant="new">{TYPE_LABELS[d.deviceType] ?? d.deviceType}</Badge></td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-on-dark-secondary">{d.storeName}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-[11px] font-mono text-on-dark-secondary">{d.firmwareVersion ?? "—"}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-[11px] text-on-dark-secondary">
                    {d.lastSeen ? timeAgo(d.lastSeen) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={d.status === "online" ? "online" : "offline"} />
                      <span className="text-[11px]">{d.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-on-dark-secondary">No devices match the filters.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
