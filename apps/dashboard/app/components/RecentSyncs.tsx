"use client";
import { trpc } from "../lib/trpc";
import { Undo2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Section, SectionHeader, Button } from "./ui";

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
    return <div className="p-4 text-on-surface-dim text-sm">Loading recent syncs…</div>;
  }
  if (!recent.data || recent.data.length === 0) {
    return <div className="p-4 text-on-surface-dim text-sm">No syncs recorded yet for this target.</div>;
  }

  return (
    <Section>
      <SectionHeader action={<span className="text-xs text-on-surface-dim">click ↶ to roll back</span>}>
        Recent syncs
      </SectionHeader>
      <ul>
        {recent.data.map((row: any) => {
          const canRollback = !!row.presetIdBefore && !row.commandId.startsWith("rollback_");
          const isPending = pendingId === row.commandId && rollback.isPending;
          return (
            <li key={row.commandId} className="cc-list-item cc-divider">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-on-dark truncate">
                  <span className="text-on-surface-dim">{row.targetId}</span>{" "}
                  {row.commandId.startsWith("rollback_") ? (
                    <span className="text-warning">↶ rollback</span>
                  ) : (
                    <span className="text-success">→ {row.presetIdAfter?.slice(0, 8) ?? "?"}</span>
                  )}
                </div>
                <div className="text-xs text-on-surface-dim">
                  {new Date(row.startedAt).toLocaleString()} · {row.scope}
                  {row.ackState?.affectedStores != null && ` · ${row.ackState.affectedStores} store(s)`}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setPendingId(row.commandId);
                  rollback.mutate({ commandId: row.commandId });
                }}
                disabled={!canRollback || isPending}
                className="flex items-center gap-1"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                Rollback
              </Button>
            </li>
          );
        })}
      </ul>
      {rollback.isError && (
        <div className="px-4 py-2 text-xs text-error border-t border-border-medium">
          {(rollback.error as unknown as Error).message}
        </div>
      )}
    </Section>
  );
}