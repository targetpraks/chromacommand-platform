"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Check, Clock, AlertTriangle, Lightbulb, Monitor, Music, ArrowRight } from "lucide-react";

interface SyncPreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  sponsor: string;
  rgbMode: string;
  musicPreset: string;
  contentPlaylist: string;
}

const syncPresets: SyncPreset[] = [
  {
    id: "mtn_takeover",
    name: "MTN TakeOver",
    primary: "#FFD100",
    secondary: "#000000",
    sponsor: "MTN",
    rgbMode: "pulse",
    musicPreset: "Afrobeats",
    contentPlaylist: "MTN TakeOver Promo",
  },
  {
    id: "fnb_takeover",
    name: "FNB / RMB TakeOver",
    primary: "#006B54",
    secondary: "#CBA135",
    sponsor: "FNB",
    rgbMode: "solid",
    musicPreset: "Lounge",
    contentPlaylist: "FNB TakeOver Promo",
  },
  {
    id: "navy_gold",
    name: "Papa Pasta Native",
    primary: "#1B2A4A",
    secondary: "#C8A951",
    sponsor: "—",
    rgbMode: "solid",
    musicPreset: "Jazz Hop",
    contentPlaylist: "Standard Menu",
  },
  {
    id: "late_night",
    name: "Late Night",
    primary: "#1B2A4A",
    secondary: "#0A0B14",
    sponsor: "—",
    rgbMode: "breath",
    musicPreset: "Deep House",
    contentPlaylist: "Late Night Menu",
  },
];

export default function SyncPage() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [scope, setScope] = useState("global");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  const handleTransform = async (preset: SyncPreset) => {
    setIsExecuting(true);
    setExecutionResult(null);

    console.log("Executing sync transform:", preset.name, {
      scope,
      fadeDurationMs: 3000,
      rgb: preset.primary,
      content: preset.contentPlaylist,
      audio: preset.musicPreset,
    });

    setTimeout(() => {
      setIsExecuting(false);
      setExecutionResult(`✅ "${preset.name}" activated across ${scope === "global" ? "all stores" : scope} in 3.2s`);
    }, 2500);
  };

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold">One-Button Sync</h1>
        <p className="text-xs text-text-secondary mt-1">Transform RGB + Content + Audio simultaneously</p>
      </motion.div>

      {/* Scope selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex items-center gap-2"
      >
        <span className="text-xs text-text-secondary">Scope:</span>
        {[
          { id: "global", label: "All Stores" },
          { id: "region-cpt", label: "Cape Town Region" },
          { id: "region-jhb", label: "JHB Region" },
          { id: "store-a01", label: "PP-A01 Only" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              scope === s.id
                ? "bg-gold text-navy"
                : "bg-panel border border-border text-text-secondary hover:text-white hover:bg-panel-hover"
            }`}
          >
            {s.label}
          </button>
        ))}
      </motion.div>

      {/* Preset grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {syncPresets.map((preset, i) => {
          const isSelected = selectedPreset === preset.id;
          const isExecutingThis = isExecuting && isSelected;
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
                        background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.primary} 60%, ${preset.secondary} 100%)`,
                      }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm">{preset.name}</h3>
                      {preset.sponsor !== "—" ? (
                        <span className="text-[10px] text-gold font-medium">{preset.sponsor} TakeOver</span>
                      ) : (
                        <span className="text-[10px] text-text-secondary">Native Theme</span>
                      )}
                    </div>
                  </div>

                  {isDone ? (
                    <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                      <Check size={14} className="text-green-400" />
                    </div>
                  ) : isExecutingThis ? (
                    <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center animate-pulse">
                      <Clock size={14} className="text-gold" />
                    </div>
                  ) : isSelected ? (
                    <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center">
                      <ArrowRight size={14} className="text-gold" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[10px] text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Lightbulb size={10} /> {preset.rgbMode}
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor size={10} /> {preset.contentPlaylist}
                  </span>
                  <span className="flex items-center gap-1">
                    <Music size={10} /> {preset.musicPreset}
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
                  <button
                    onClick={() => handleTransform(preset)}
                    disabled={isExecuting}
                    className="w-full py-3 bg-gold text-navy font-semibold text-sm rounded-lg hover:bg-gold/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isExecuting ? (
                      <>Transforming... <Clock size={14} className="animate-spin" /></>
                    ) : (
                      <><Zap size={14} strokeWidth={2.5} /> Activate {preset.name}</>
                    )}
                  </button>
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
          className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded-xl text-sm text-green-400 flex items-center gap-2"
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
        <div className="grid grid-cols-3 gap-4 text-[10px] text-text-secondary">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            PP-A01: Navy & Gold — Online (2s)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            PP-A02: MTN Yellow — Online (5s)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            PP-J01: Disconnected (3h)
          </div>
        </div>
      </motion.div>
    </div>
  );
}
