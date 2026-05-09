"use client";

import { motion } from "framer-motion";
import { Monitor, Lightbulb, Music, ArrowLeft, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "../../lib/trpc";
import { StatusDot, ProgressBar, Badge, Button, Card, Spinner } from "../../components/ui";

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.id as string;

  const { data: store, isLoading, refetch } = trpc.stores.get.useQuery({ id: storeId });
  const { data: rgbState } = trpc.rgb.getState.useQuery({ storeId }, { refetchInterval: 3000 });

  if (isLoading || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const isOnline = store.status === "online";

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link href="/" className="flex items-center gap-1 text-xs text-on-dark-secondary hover:text-gold transition mb-4">
          <ArrowLeft size={12} /> Back to Matrix
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-on-dark-secondary">{store.id.toUpperCase()}</span>
              <StatusDot status={isOnline ? "online" : "offline"} />
            </div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-xs text-on-dark-secondary mt-1">{store.address || "Address not set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw size={12} /> Refresh
            </Button>
            <Button variant="primary" size="sm">
              <Zap size={12} /> Activate TakeOver
            </Button>
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
              <Button variant="ghost" size="sm">All On</Button>
              <Button variant="ghost" size="sm">All Off</Button>
              <Button variant="ghost" size="sm">Set All</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(store.zones || []).map((zone: any, i: number) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.04 }}
              >
                <Card className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium">{zone.displayName}</p>
                      <p className="text-[10px] text-on-dark-secondary">{zone.group} · {zone.ledCount} LEDs</p>
                    </div>
                    <Badge variant={zone.status === "online" ? "success" : "error"}>
                      {zone.status}
                    </Badge>
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
                      <div className="flex items-center gap-1 text-[10px] text-on-dark-secondary mb-1">
                        <span>{zone.currentMode}</span>
                        <span>·</span>
                        <span>{Math.round((zone.maxBrightness || 0) * 100)}%</span>
                      </div>
                      <ProgressBar value={zone.maxBrightness || 0} variant="gold" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Screens + Audio */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Monitor size={16} /> Screens ({store.screens?.length || 0})</h3>
            <div className="space-y-2">
              {(store.screens || []).map((screen: any) => (
                <div key={screen.id} className="flex items-center justify-between p-2 bg-dark rounded-lg">
                  <div className="flex items-center gap-2">
                    <StatusDot status={screen.status === "online" ? "online" : "offline"} />
                    <div>
                      <p className="text-xs font-medium">{screen.id.split("-").pop()}</p>
                      <p className="text-[10px] text-on-dark-secondary">{screen.hardwareType}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gold truncate max-w-[150px]">{screen.currentAsset || "Standard Menu"}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Music size={16} /> Audio Zones ({store.audioZones?.length || 0})</h3>
            <div className="space-y-2">
              {(store.audioZones || []).map((az: any) => (
                <div key={az.id} className="p-2 bg-dark rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs capitalize">{az.zoneType}</span>
                    <span className="text-[10px] text-on-dark-secondary">{az.sinkName || "—"}</span>
                  </div>
                  <ProgressBar value={az.volume || 0} variant="info" />
                  <div className="flex justify-between text-[9px] text-on-dark-secondary mt-1">
                    <span>{az.status}</span>
                    <span>{Math.round((az.volume || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}