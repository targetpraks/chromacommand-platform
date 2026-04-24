"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { StoreCard } from "../components/StoreCard";

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

export default function StoresPage() {
  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Stores</h1>
        <p className="text-xs text-text-secondary mt-1">{demoStores.length} stores in network</p>
      </motion.div>

      <div className="mt-6 space-y-3">
        {demoStores.map((store, i) => (
          <StoreCard key={store.id} store={store} index={i} />
        ))}
      </div>
    </div>
  );
}
