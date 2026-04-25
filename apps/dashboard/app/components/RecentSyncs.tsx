"use client";
import { trpc } from "../lib/trpc";
import { Undo2, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Drop-in widget that lists the most recent sync_transactions for a target,
 * with a per-row Rollback button. Powers PRD §21.3's operator-controlled
 * compensation flow.
 */
export function RecentSyncs({ targetId }: { targetId?: string }) {
  const utils = trpc.useUtils();
  const recent = trpc.sync.recent.useQuery({ targetId, limit: 10 });
  const rollback = trpc.sync.rollback.useMutation({
    onSuccess: () => {
      void utils.sync.recent.invalidate();
      void utils.stores.list.invalidate();
    },
  });
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (recent.isLoading) {
    return <div className="p-4 text-zinc-500 text-sm">Loading recent syncs…</div>;
  }
  if (!recent.data || recent.data.length === 0) {
    return <div className="p-4 text-zinc-500 text-sm">No syncs recorded yet for this target.</div>;
  }

  return (
    <div className="rounded-lg border border-[#1F2230] bg-[#11131C]">
      <div className="px-4 py-3 border-b border-[#1F2230] flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Recent syncs</h3>
        <span className="text-xs text-zinc-500">click ↶ to roll back</span>
      </div>
      <ul className="divide-y divide-[#1F2230]">
        {recent.data.map((row: any) => {
          const canRollback = !!row.presetIdBefore && !row.commandId.startsWith("rollback_");
          const isPending = pendingId === row.commandId && rollback.isPending;
          return (
            <li key={row.commandId} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100 truncate">
                  <span className="text-zinc-500">{row.targetId}</span>{" "}
                  {row.commandId.startsWith("rollback_") ? (
                    <span className="text-orange-300">↶ rollback</span>
                  ) : (
                    <span className="text-emerald-300">→ {row.presetIdAfter?.slice(0, 8) ?? "?"}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(row.startedAt).toLocaleString()} · {row.scope}
                  {row.ackState?.affectedStores != null && ` · ${row.ackState.affectedStores} store(s)`}
                </div>
              </div>
              <button
                onClick={() => {
                  setPendingId(row.commandId);
                  rollback.mutate({ commandId: row.commandId });
                }}
                disabled={!canRollback || isPending}
                className="text-xs px-2 py-1 rounded border border-[#2A2D3A] hover:bg-[#1A1D28] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                title={canRollback ? "Roll back to the preset before this sync" : "No prior preset to roll back to"}
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                Rollback
              </button>
            </li>
          );
        })}
      </ul>
      {rollback.isError && (
        <div className="px-4 py-2 text-xs text-red-400 border-t border-[#1F2230]">
          {(rollback.error as Error).message}
        </div>
      )}
    </div>
  );
}
