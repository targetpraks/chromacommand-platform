"use client";

import { motion } from "framer-motion";
import { Music, Volume2, VolumeX, Play, Pause, SkipForward, Mic } from "lucide-react";

export default function AudioPage() {
  const zones = [
    { zone: "dining", name: "Dining Area", volume: 0.45, playlist: "Jazz Hop", status: "playing" },
    { zone: "pickup", name: "Pickup Counter", volume: 0.55, playlist: "Jazz Hop", status: "playing" },
    { zone: "exterior", name: "Exterior", volume: 0, playlist: "—", status: "stopped" },
    { zone: "back-of-house", name: "Back of House", volume: 0.2, playlist: "—", status: "stopped" },
  ];

  const playlists = [
    { id: "papa_native", name: "Papa Native", genre: "Jazz Hop, Lo-Fi", colour: "#1B2A4A" },
    { id: "mtn_afrobeats", name: "MTN Soundscape", genre: "Afrobeats, Electronic", colour: "#FFD100" },
    { id: "fnb_lounge", name: "FNB Lounge", genre: "Lounge, Sophisticated", colour: "#006B54" },
    { id: "morning_rush", name: "Morning Rush", genre: "Upbeat House", colour: "#C8A951" },
    { id: "late_night", name: "Late Night", genre: "Deep House", colour: "#1B2A4A" },
  ];

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Audio Control</h1>
        <p className="text-xs text-text-secondary mt-1">Manage music, playlists, and announcements per zone</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zones */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-panel rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Music size={16} /> Audio Zones</h2>
          <div className="space-y-3">
            {zones.map((z) => (
              <div key={z.zone} className="p-3 bg-dark rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{z.name}</p>
                    <p className="text-[10px] text-text-secondary">{z.playlist}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 flex items-center justify-center bg-panel rounded-lg hover:bg-panel-hover">{z.status === "playing" ? <Pause size={12} /> : <Play size={12} />}</button>
                    <button className="w-7 h-7 flex items-center justify-center bg-panel rounded-lg hover:bg-panel-hover"><SkipForward size={12} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-text-secondary hover:text-white"><VolumeX size={12} /></button>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${z.volume * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-text-secondary w-7 text-right">{Math.round(z.volume * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gold/10 text-gold rounded-lg hover:bg-gold/20">
              <Mic size={12} /> TTS Announcement
            </button>
          </div>
        </motion.div>

        {/* Playlists */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-panel rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4">Music Presets</h2>
          <div className="space-y-2">
            {playlists.map((pl, i) => (
              <motion.div
                key={pl.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center gap-3 p-2 bg-dark rounded-lg hover:bg-panel-hover cursor-pointer transition"
              >
                <div
                  className="w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: pl.colour, boxShadow: `0 0 8px ${pl.colour}40` }}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium">{pl.name}</p>
                  <p className="text-[10px] text-text-secondary">{pl.genre}</p>
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
