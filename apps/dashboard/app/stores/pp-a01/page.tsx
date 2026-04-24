"use client";

import { motion } from "framer-motion";
import { Circle, Monitor, Lightbulb, Music, WifiOff, ArrowLeft, Sun, Moon, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";

// Demo store detail data
const storeDetail = {
  id: "pp-a01",
  name: "PP-A01 Cape Town CBD",
  region: "Cape Town",
  address: "Shop 4, Wale Street, Cape Town CBD, 8001",
  storeManager: "John Dlamini",
  status: "online",
  lastHeartbeat: "2026-04-24T18:30:42Z",
  zones: [
    { id: "ceiling", displayName: "Ceiling Cove", group: "ambient", colour: "#1B2A4A", mode: "solid", brightness: 0.85, ledCount: 350, status: "online" },
    { id: "window", displayName: "Window Frame", group: "ambient", colour: "#1B2A4A", mode: "solid", brightness: 0.85, ledCount: 175, status: "online" },
    { id: "undercounter", displayName: "Undercounter Glow", group: "ambient", colour: "#C8A951", mode: "gradient", brightness: 0.75, ledCount: 95, status: "online" },
    { id: "wall-wash", displayName: "Back Wall Wash", group: "decorative", colour: "#1B2A4A", mode: "breath", brightness: 0.7, ledCount: 250, status: "online" },
    { id: "counter-front", displayName: "Counter Front", group: "service", colour: "#FFFFFF", mode: "solid", brightness: 0.95, ledCount: 120, status: "online" },
    { id: "pickup", displayName: "Pickup Indicator", group: "service", colour: "#00D26A", mode: "solid", brightness: 0.9, ledCount: 85, status: "online" },
    { id: "table-1", displayName: "Table 1 Edge", group: "furniture", colour: "#C8A951", mode: "solid", brightness: 0.6, ledCount: 50, status: "online" },
    { id: "signage", displayName: "Signage Fascia", group: "exterior", colour: "#1B2A4A", mode: "pulse", brightness: 0.9, ledCount: 220, status: "online" },
  ],
  screens: [
    { id: "menu-primary", type: "eink", model: "Visionect 12\"", status: "online", currentAsset: "Fusilli Napoletana — R89" },
    { id: "menu-combo", type: "eink", model: "Visionect 12\"", status: "online", currentAsset: "Combo Deal — R149" },
    { id: "promo-board", type: "lcd", model: "Samsung 32\"", status: "online", currentAsset: "MTN TakeOver — Week 2" },
  ],
  audioZones: [
    { zone: "dining", playlist: "Jazz Hop", volume: 0.45, status: "playing" },
    { zone: "pickup", playlist: "Jazz Hop", volume: 0.55, status: "playing" },
    { zone: "exterior", playlist: "—", volume: 0, status: "stopped" },
  ],
};

export default function StoreDetailPage() {
  return (
    <div className="min-h-screen px-6 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link href="/" className="flex items-center gap-1 text-xs text-text-secondary hover:text-gold transition mb-4">
          <ArrowLeft size={12} /> Back to Matrix
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-text-secondary">{storeDetail.id.toUpperCase()}</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold">{storeDetail.name}</h1>
            <p className="text-xs text-text-secondary mt-1">{storeDetail.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-panel border border-border rounded-lg hover:bg-panel-hover">
              <RefreshCw size={12} /> Refresh
            </button>
            <button className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-gold text-navy rounded-lg hover:bg-gold/90">
              <Zap size={12} /> Activate TakeOver
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {["Overview", "RGB Zones", "Screens", "Audio", "Sensors", "History"].map((tab) => (
          <button key={tab} className="px-4 py-2 text-xs font-medium text-gold border-b-2 border-gold">
            {tab}
          </button>
        ))}
      </div>

      {/* RGB Zones Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb size={16} /> LED Zones ({storeDetail.zones.length})
            </h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">All On</button>
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">All Off</button>
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">Set All</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {storeDetail.zones.map((zone, i) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="bg-panel rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium">{zone.displayName}</p>
                    <p className="text-[10px] text-text-secondary">{zone.group} · {zone.ledCount} LEDs</p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${zone.status === "online" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {zone.status}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10"
                    style={{
                      backgroundColor: zone.colour,
                      boxShadow: `0 0 12px ${zone.colour}50`,
                      opacity: zone.brightness,
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1 text-[10px] text-text-secondary mb-1">
                      <span>{zone.mode}</span>
                      <span>·</span>
                      <span>{Math.round(zone.brightness * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gold/50 rounded-full transition-all" style={{ width: `${zone.brightness * 100}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Screens + Audio */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Screens */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-panel rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Monitor size={16} /> Screens ({storeDetail.screens.length})</h3>
            <div className="space-y-2">
              {storeDetail.screens.map((screen) => (
                <div key={screen.id} className="flex items-center justify-between p-2 bg-dark rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-xs font-medium">{screen.id}</p>
                      <p className="text-[10px] text-text-secondary">{screen.model}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gold truncate max-w-[150px]">{screen.currentAsset}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Audio */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="bg-panel rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Music size={16} /> Audio Zones ({storeDetail.audioZones.length})</h3>
            <div className="space-y-2">
              {storeDetail.audioZones.map((az) => (
                <div key={az.zone} className="p-2 bg-dark rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs capitalize">{az.zone}</span>
                    <span className="text-[10px] text-text-secondary">{az.playlist || "—"}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${az.volume * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-text-secondary mt-1">
                    <span>{az.status}</span>
                    <span>{Math.round(az.volume * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
