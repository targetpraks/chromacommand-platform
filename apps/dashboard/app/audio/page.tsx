"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Music, Volume2, VolumeX, Play, Pause, SkipForward, Mic } from "lucide-react";
import { trpc } from "../lib/trpc";

export default function AudioPage() {
  const [selectedStore, setSelectedStore] = useState("pp-a01");
  const { data: stores } = trpc.stores.list.useQuery();
  const { data: zones } = trpc.audio.getZoneState.useQuery({ storeId: selectedStore });
  const { data: playlists } = trpc.audio.getZoneState.useQuery({ storeId: "library" });
  const audioMutation = trpc.audio.set.useMutation();
  const announceMutation = trpc.audio.announce.useMutation();

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Audio Control</h1>
        <p className="text-xs text-text-secondary mt-1">Manage music, playlists, and announcements per zone</p>
      </motion.div>

      <div className="mt-4 mb-6">
        <label className="text-xs text-text-secondary mb-1 block">Store</label>
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="px-3 py-1.5 text-xs bg-panel border border-border rounded-lg"
        >
          {stores?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-panel rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Music size={16} /> Audio Zones</h2>
          <div className="space-y-3">
            {zones?.map((z: any) => (
              <div key={z.id} className="p-3 bg-dark rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{z.sinkName || z.zoneType}</p>
                    <p className="text-[10px] text-text-secondary">{z.status}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => audioMutation.mutate({ scope: "store", targetId: selectedStore, zone: z.zoneType, action: z.status === "playing" ? "pause" : "play", volume: z.volume })}
                      className="w-7 h-7 flex items-center justify-center bg-panel rounded-lg hover:bg-panel-hover"
                    >
                      {z.status === "playing" ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button className="w-7 h-7 flex items-center justify-center bg-panel rounded-lg hover:bg-panel-hover"><SkipForward size={12} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-text-secondary hover:text-white"><VolumeX size={12} /></button>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(z.volume || 0) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-text-secondary w-7 text-right">{Math.round((z.volume || 0) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                const text = prompt("Announcement text?");
                if (text) announceMutation.mutate({ scope: "store", targetId: selectedStore, zones: ["dining", "pickup"], text, duckMusic: true });
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gold/10 text-gold rounded-lg hover:bg-gold/20"
            >
              <Mic size={12} /> TTS Announcement
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-panel rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4">Music Presets</h2>
          <div className="space-y-2">
            {(playlists ?? [])?.map((pl: any, i: number) => (
              <motion.div
                key={pl.id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center gap-3 p-2 bg-dark rounded-lg hover:bg-panel-hover cursor-pointer transition"
              >
                <div className="w-8 h-8 rounded-lg shrink-0 bg-navy border border-white/10" />
                <div className="flex-1">
                  <p className="text-xs font-medium">{pl.sinkName || pl.zoneType || "Playlist"}</p>
                  <p className="text-[10px] text-text-secondary">{pl.tags?.join(", ") || pl.status || "Playlist"}</p>
                </div>
                <button className="w-6 h-6 flex items-center justify-center bg-panel rounded hover:bg-gold hover:text-navy transition">
                  <Play size={10} />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
