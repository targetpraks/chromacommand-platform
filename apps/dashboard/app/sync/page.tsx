"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Check, Clock, AlertTriangle, Lightbulb, Monitor, Music, ArrowRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import { RecentSyncs } from "../components/RecentSyncs";
import { Button, Card, Badge, Spinner, StatusDot, Section } from "../components/ui";

export default function SyncPage() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [scope, setScope] = useState("global");
  const [storeTarget, setStoreTarget] = useState("pp-a01");
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  const { data: presets } = trpc.rgb.listPresets.useQuery();
  const { data: stores } = trpc.stores.list.useQuery();
  const syncMutation = trpc.sync.transform.useMutation({
    onSuccess: (data) => {
      setExecutionResult(`✅ "${selectedPresetName}" activated · Command ${data.commandId}`);
    },
    onError: (err) => {
      setExecutionResult(`❌ Failed: ${err.message}`);
    },
  });

  const selectedPresetName = (presets ?? []).find((p) => p.id === selectedPreset)?.name ?? "";

  const handleTransform = async (presetId: string) => {
    setExecutionResult(null);

    let actualScope: "global" | "region" | "store" = "global";
    let targetId = "all";
    if (scope.startsWith("region-")) {
      actualScope = "region";
      targetId = scope === "region-cpt" ? "cape-town" : "johannesburg";
    } else if (scope === "store") {
      actualScope = "store";
      targetId = storeTarget;
    }

    await syncMutation.mutateAsync({
      scope: actualScope,
      targetId,
      presetId,
      effectiveAt: new Date().toISOString(),
      fadeDurationMs: 3000,
      components: { rgb: true, content: true, audio: true },
    });
  };

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold">One-Button Sync</h1>
        <p className="text-xs text-on-dark-secondary mt-1">Transform RGB + Content + Audio simultaneously</p>
      </motion.div>

      {/* Scope selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex items-center gap-2"
      >
        <span className="text-xs text-on-dark-secondary">Scope:</span>
        {[
          { id: "global", label: "All Stores" },
          { id: "region-cpt", label: "Cape Town Region" },
          { id: "region-jhb", label: "JHB Region" },
          { id: "store", label: "Single Store" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              scope === s.id
                ? "bg-gold text-navy"
                : "bg-panel border border-border text-on-dark-secondary hover:text-on-surface hover:bg-panel-hover"
            }`}
          >
            {s.label}
          </button>
        ))}
        {scope === "store" && (
          <select className="cc-input !py-1.5 text-xs max-w-[220px]" value={storeTarget} onChange={(e) => setStoreTarget(e.target.value)}>
            {(stores ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </motion.div>

      {/* Preset grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {(presets ?? []).map((preset, i) => {
          const colours = (preset.colours ?? {}) as Record<string, string>;
          const primary = colours.all ?? Object.values(colours)[0] ?? "#1B2A4A";
          const isSponsor = /mtn|fnb|vodacom|telkom|sponsor/i.test(preset.name);
          const isSelected = selectedPreset === preset.id;
          const isExecuting = syncMutation.isPending && isSelected;
          const isDone = executionResult !== null && isSelected && !isExecuting;

          return (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <button
                onClick={() => setSelectedPreset(preset.id)}
                className={`w-full text-left p-5 rounded-xl border transition-all ${
                  isSelected
                    ? "border-gold bg-gold/5"
                    : "border-border bg-panel hover:border-gold/20 hover:bg-panel-hover"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg border border-white/10"
                      style={{
                        background: `linear-gradient(135deg, ${primary} 0%, ${primary} 60%, ${primary} 100%)`,
                      }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm">{preset.name}</h3>
                      {isSponsor ? (
                        <span className="text-[10px] text-gold font-medium">Sponsor TakeOver</span>
                      ) : (
                        <span className="text-[10px] text-on-dark-secondary">Native Theme</span>
                      )}
                    </div>
                  </div>

                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
                      <Check size={14} className="text-success" />
                    </div>
                  ) : isExecuting ? (
                    <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center animate-pulse">
                      <Clock size={14} className="text-gold" />
                    </div>
                  ) : isSelected ? (
                    <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center">
                      <ArrowRight size={14} className="text-gold" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[10px] text-on-dark-secondary">
                  <span className="flex items-center gap-1">
                    <Lightbulb size={10} /> {preset.mode}
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor size={10} /> {Math.round((preset.brightness ?? 1) * 100)}% brightness
                  </span>
                  <span className="flex items-center gap-1">
                    <Music size={10} /> RGB + Content + Audio
                  </span>
                </div>
              </button>

              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => handleTransform(preset.id)}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? (
                      <>Transforming... <Clock size={14} className="animate-spin" /></>
                    ) : (
                      <><Zap size={14} strokeWidth={2.5} /> Activate {preset.name}</>
                    )}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Execution result */}
      {executionResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-success/5 border border-success/20 rounded-xl text-sm text-success flex items-center gap-2"
        >
          <Check size={16} /> {executionResult}
        </motion.div>
      )}

      {/* Status preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 p-4 bg-panel rounded-xl border border-border"
      >
        <h3 className="text-sm font-semibold mb-3">Live Status Preview</h3>
        <div className="grid grid-cols-3 gap-4 text-[10px] text-on-dark-secondary">
          <div className="flex items-center gap-2">
            <StatusDot status="online" />
            PP-A01: Navy & Gold — Online (2s)
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status="online" />
            PP-A02: MTN Yellow — Online (5s)
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status="offline" />
            PP-J01: Disconnected (3h)
          </div>
        </div>
      </motion.div>

      <div className="mt-8">
        <RecentSyncs />
      </div>
    </div>
  );
}