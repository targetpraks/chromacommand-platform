"use client";

import { motion } from "framer-motion";
import { Monitor, Lightbulb, Music, ArrowLeft, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "../../lib/trpc";

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.id as string;

  const { data: store, isLoading, refetch } = trpc.stores.get.useQuery({ id: storeId });
  const { data: rgbState } = trpc.rgb.getState.useQuery({ storeId }, { refetchInterval: 3000 });

  if (isLoading || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOnline = store.status === "online";

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link href="/" className="flex items-center gap-1 text-xs text-text-secondary hover:text-gold transition mb-4">
          <ArrowLeft size={12} /> Back to Matrix
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-text-secondary">{store.id.toUpperCase()}</span>
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            </div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-xs text-text-secondary mt-1">{store.address || "Address not set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-panel border border-border rounded-lg hover:bg-panel-hover">
              <RefreshCw size={12} /> Refresh
            </button>
            <button className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-gold text-navy rounded-lg hover:bg-gold/90">
              <Zap size={12} /> Activate TakeOver
            </button>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 flex gap-1 border-b border-border">
        {["Overview", "RGB Zones", "Screens", "Audio", "Sensors", "History"].map((tab) => (
          <button key={tab} className="px-4 py-2 text-xs font-medium text-gold border-b-2 border-gold">
            {tab}
          </button>
        ))}
      </div>

      {/* RGB Zones */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb size={16} /> LED Zones ({store.zones?.length || 0})
            </h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">All On</button>
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">All Off</button>
              <button className="px-3 py-1 text-[10px] bg-panel border border-border rounded hover:bg-panel-hover">Set All</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(store.zones || []).map((zone: any, i: number) => (
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
                      backgroundColor: zone.currentColour,
                      boxShadow: `0 0 12px ${zone.currentColour}50`,
                      opacity: zone.maxBrightness,
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1 text-[10px] text-text-secondary mb-1">
                      <span>{zone.currentMode}</span>
                      <span>·</span>
                      <span>{Math.round((zone.maxBrightness || 0) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gold/50 rounded-full transition-all" style={{ width: `${(zone.maxBrightness || 0) * 100}%` }} />
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-panel rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Monitor size={16} /> Screens ({store.screens?.length || 0})</h3>
            <div className="space-y-2">
              {(store.screens || []).map((screen: any) => (
                <div key={screen.id} className="flex items-center justify-between p-2 bg-dark rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${screen.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                    <div>
                      <p className="text-xs font-medium">{screen.id.split("-").pop()}</p>
                      <p className="text-[10px] text-text-secondary">{screen.hardwareType}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gold truncate max-w-[150px]">{screen.currentAsset || "Standard Menu"}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="bg-panel rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Music size={16} /> Audio Zones ({store.audioZones?.length || 0})</h3>
            <div className="space-y-2">
              {(store.audioZones || []).map((az: any) => (
                <div key={az.id} className="p-2 bg-dark rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs capitalize">{az.zoneType}</span>
                    <span className="text-[10px] text-text-secondary">{az.sinkName || "—"}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(az.volume || 0) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-text-secondary mt-1">
                    <span>{az.status}</span>
                    <span>{Math.round((az.volume || 0) * 100)}%</span>
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
