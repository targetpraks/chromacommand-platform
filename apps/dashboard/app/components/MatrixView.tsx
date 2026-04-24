"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Filter, RefreshCw, Zap, Sun, Moon } from "lucide-react";
import { StoreCard } from "./StoreCard";
import { trpc } from "../lib/trpc";
import { useLiveSocket } from "../hooks/useLiveSocket";
import { useQueryClient } from "@tanstack/react-query";

// Demo stores — fallback while loading
const demoStores = [
  {
    id: "pp-a01",
    name: "PP-A01 Cape Town CBD",
    region: "Cape Town",
    status: "online" as const,
    zones: [
      { id: "ceiling", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
      { id: "window", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
      { id: "undercounter", colour: "#C8A951", mode: "gradient", brightness: 0.75 },
      { id: "counter-front", colour: "#FFFFFF", mode: "solid", brightness: 0.95 },
      { id: "pickup", colour: "#00D26A", mode: "solid", brightness: 0.9 },
      { id: "signage", colour: "#1B2A4A", mode: "pulse", brightness: 0.9 },
    ],
    screens: 3,
    activeContent: "Standard Menu",
    lastHeartbeat: "2s ago",
    audioZone: "Jazz Hop",
  },
  {
    id: "pp-a02",
    name: "PP-A02 Gardens",
    region: "Cape Town",
    status: "online" as const,
    zones: [
      { id: "ceiling", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
      { id: "window", colour: "#1B2A4A", mode: "solid", brightness: 0.85 },
      { id: "undercounter", colour: "#C8A951", mode: "solid", brightness: 0.7 },
    ],
    screens: 3,
    activeContent: "MTN TakeOver — Week 2",
    lastHeartbeat: "5s ago",
    audioZone: "Afrobeats",
  },
  {
    id: "pp-j01",
    name: "PP-J01 Sandton",
    region: "Johannesburg",
    status: "offline" as const,
    zones: [
      { id: "ceiling", colour: "#1B2A4A", mode: "solid", brightness: 0.5 },
      { id: "window", colour: "#1B2A4A", mode: "solid", brightness: 0.5 },
    ],
    screens: 3,
    activeContent: "Standard Menu (Cached)",
    lastHeartbeat: "3h ago",
    audioZone: "—",
  },
];

export function MatrixView() {
  const [filter, setFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryClient = useQueryClient();

  const { data: dbStores, isLoading, refetch } = trpc.stores.list.useQuery(undefined);

  // Live WebSocket — refresh data on real-time events
  useLiveSocket((msg) => {
    if (msg.type === "rgb_update" || msg.type === "sync_complete" || msg.type === "audio_update" || msg.type === "store_status") {
      void queryClient.invalidateQueries({ queryKey: [["stores", "list"]] });
    }
  });

  // If DB data exists, use it. Otherwise fall back to demo data.
  // Map DB shape to UI shape (DB uses regionId, UI uses region; DB uses status "active"/"offline", UI uses "online"/"offline")
  const storeData = dbStores ?? demoStores;

  const filteredStores = filter === "all" ? storeData : storeData.filter((s: any) => s.region.toLowerCase().includes(filter.toLowerCase()));

  const onlineCount = storeData.filter((s: any) => s.status === "online").length;
  const offlineCount = storeData.filter((s: any) => s.status === "offline").length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-dark/90 backdrop-blur border-b border-border"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Network Matrix</h1>
            <p className="text-xs text-text-secondary mt-0.5">
              {onlineCount} online · {offlineCount} offline · {storeData.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-panel border border-border rounded-lg hover:bg-panel-hover transition"
            >
              <option value="all">All Regions</option>
              <option value="cape">Cape Town</option>
              <option value="johannesburg">Johannesburg</option>
              <option value="durban">Durban</option>
            </select>
            <button
              onClick={() => { setIsRefreshing(true); refetch().finally(() => setIsRefreshing(false)); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-panel border border-border rounded-lg hover:bg-panel-hover transition"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-gold text-navy rounded-lg hover:bg-gold/90 transition">
              <Zap size={12} strokeWidth={2.5} /> Sync All
            </button>
          </div>
        </div>
      </motion.header>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-6 py-4 grid grid-cols-4 gap-3"
      >
        {[
          { label: "RGB Zones Active", value: `${Math.round(filteredStores.reduce((acc: number, s: any) => acc + (s.zones?.length ?? 0), 0) * 0.95)}/${filteredStores.reduce((acc: number, s: any) => acc + (s.zones?.length ?? 0), 0)}`, colour: "bg-gold/10 text-gold" },
          { label: "Screens Online", value: `${storeData.filter((s: any) => s.status === "online").reduce((acc: number, s: any) => acc + (s.screens ?? 0), 0)}`, colour: "bg-green-500/10 text-green-400" },
          { label: "Audio Zones", value: `${storeData.filter((s: any) => s.status === "online").length * 2}`, colour: "bg-blue-500/10 text-blue-400" },
          { label: "Active TakeOver", value: "1", colour: "bg-purple-500/10 text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.colour} px-4 py-3 rounded-lg`}>
            <p className="text-[10px] font-medium opacity-70">{stat.label}</p>
            <p className="text-lg font-bold mt-0.5">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Store grid */}
      <div className="px-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredStores.map((store: any, i: number) => (
              <StoreCard key={store.id} store={store} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
