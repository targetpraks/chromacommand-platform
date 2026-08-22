"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ListChecks } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Card, Badge, Spinner } from "../components/ui";

const STATUS_STYLES: Record<string, string> = {
  dispatched: "text-info border-info/40 bg-info/10",
  complete: "text-success border-success/40 bg-success/10",
  partial: "text-warning border-warning/40 bg-warning/10",
  failed: "text-error border-error/40 bg-error/10",
};

export default function CommandsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: commands, isLoading } = trpc.commands.list.useQuery({ limit: 100 }, { refetchInterval: 5000 });
  const { data: detail } = trpc.commands.get.useQuery({ commandId: selected! }, { enabled: !!selected });

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold flex items-center gap-2"><ListChecks size={20} /> Command Centre</h1>
        <p className="text-xs text-on-dark-secondary mt-1">Every dispatch with its device acknowledgements — the dispatch→ack loop, in the open.</p>
      </motion.div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-0 overflow-hidden xl:col-span-2">
          {isLoading ? (
            <div className="grid place-items-center py-12"><Spinner /></div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-on-dark-secondary border-b border-border-medium">
                  <th className="px-4 py-2.5">Command</th>
                  <th className="px-4 py-2.5">Kind</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Scope</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 hidden lg:table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {(commands ?? []).map((c) => (
                  <tr
                    key={c.commandId}
                    onClick={() => setSelected(c.commandId)}
                    className={`border-b border-border-medium/50 cursor-pointer transition hover:bg-panel-hover/50 ${selected === c.commandId ? "bg-gold/5" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-[11px]">{c.commandId.slice(0, 24)}…</td>
                    <td className="px-4 py-2.5 text-xs">{c.kind}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-[11px] text-on-dark-secondary">{c.scope}:{c.targetId}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] ${STATUS_STYLES[c.status] ?? ""}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-[11px] text-on-dark-secondary">{timeAgo(c.createdAt)}</td>
                  </tr>
                ))}
                {(commands ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-on-dark-secondary">No commands yet — dispatch something from Master Control.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-4 self-start">
          <h3 className="text-sm font-semibold mb-3">Ack Trail</h3>
          {!detail ? (
            <p className="text-xs text-on-dark-secondary">Select a command to see per-device acknowledgements.</p>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[11px] break-all">{detail.commandId}</p>
              <div className="flex gap-1 flex-wrap">
                {Object.keys(((detail.targets as any)?.stores ?? [])).length >= 0 && (
                  <Badge variant="new">{((detail.targets as any)?.stores ?? []).length} store(s)</Badge>
                )}
                <Badge variant="new">{detail.kind}</Badge>
              </div>
              <div className="mt-3 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {Object.entries((detail.ackState as Record<string, any>) ?? {}).map(([deviceId, ack]) => (
                  <div key={deviceId} className="flex items-center justify-between p-2 bg-dark rounded-lg">
                    <span className="text-[11px] font-mono truncate">{deviceId}</span>
                    <span className={`text-[10px] ${ack.status === "failed" ? "text-error" : "text-success"}`}>{ack.status}</span>
                  </div>
                ))}
                {Object.keys((detail.ackState as Record<string, any>) ?? {}).length === 0 && (
                  <p className="text-[11px] text-on-dark-secondary">No device acks recorded yet.</p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function timeAgo(ts: string | Date | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
