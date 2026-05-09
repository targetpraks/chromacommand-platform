"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Music, WifiOff } from "lucide-react";
import Link from "next/link";
import { StatusDot } from "./ui";

interface StoreCardProps {
  store: {
    id: string;
    name: string;
    region: string;
    status: "online" | "offline" | "setup";
    zones: { id: string; colour: string; mode: string; brightness: number }[];
    screens: number;
    activeContent: string;
    lastHeartbeat: string;
    audioZone: string;
  };
  index: number;
}

export function StoreCard({ store, index }: StoreCardProps) {
  const isOnline = store.status === "online";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link href={`/stores/${store.id}`}>
        <div className="cc-card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="cc-mono">{store.id.toUpperCase()}</span>
                <StatusDot status={isOnline ? "online" : "offline"} />
              </div>
              <h3 className="font-semibold text-sm leading-tight truncate text-on-dark">{store.name}</h3>
              <p className="text-[10px] text-on-dark-secondary mt-0.5">{store.region}</p>
            </div>
            {!isOnline && <WifiOff size={14} className="text-red-400 shrink-0" />}
          </div>

          <div className="flex gap-1 mb-3">
            <AnimatePresence>
              {store.zones.slice(0, 6).map((zone) => (
                <motion.div
                  key={zone.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="group/tooltip relative"
                >
                  <div
                    className="w-5 h-5 rounded-md border border-white/5"
                    style={{
                      backgroundColor: zone.colour,
                      opacity: zone.brightness,
                      boxShadow: `0 0 8px ${zone.colour}40`,
                    }}
                  />
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-dark border border-gold/20 rounded px-1.5 py-0.5 text-[9px] text-gold opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {zone.id}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {store.zones.length > 6 && (
              <div className="w-5 h-5 rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-[8px] text-on-dark-secondary">
                +{store.zones.length - 6}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-on-dark-secondary">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Monitor size={10} /> {store.screens}
              </span>
              <span className="flex items-center gap-1">
                <Music size={10} /> {store.audioZone || "—"}
              </span>
            </div>
            <span className="truncate max-w-[120px]">{store.activeContent}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}