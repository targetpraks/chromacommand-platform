"use client";

import { motion } from "framer-motion";
import { TrendingUp, Eye, Footprints, QrCode, Clock } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Card, Badge, ProgressBar } from "../components/ui";

export default function AnalyticsPage() {
  const { data: stats, isLoading } = trpc.analytics.getStats.useQuery({});
  const { data: contentPerf } = trpc.analytics.getContentPerformance.useQuery({});
  const { data: activity } = trpc.analytics.getActivityLog.useQuery({ limit: 10 });

  const statCards = stats ? [
    { label: "Total Impressions Today", value: (stats as any).impressions?.toLocaleString() ?? "—", change: "+8.2%", variant: "gold" as const },
    { label: "Footfall", value: (stats as any).footfall?.toLocaleString() ?? "—", change: "+12.1%", variant: "success" as const },
    { label: "QR Scans", value: (stats as any).qrScans?.toLocaleString() ?? "—", change: "+23.4%", variant: "info" as const },
    { label: "Avg Dwell Time", value: `${(stats as any).avgDwellMinutes ?? "—"} min`, change: "+2 min", variant: "warning" as const },
  ] : [];

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Analytics</h1>
        <p className="text-xs text-on-dark-secondary mt-1">Real-time data from across the franchise network</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={stat.variant}>{stat.change}</Badge>
              </div>
              <p className="text-[10px] font-medium text-on-dark-secondary">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} className="text-on-dark-secondary" />
              <h2 className="text-sm font-semibold">Activity Log</h2>
            </div>
            <div className="space-y-2">
              {activity?.map((log: any) => (
                <div key={log.id} className="p-2 bg-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs capitalize">{log.action.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-on-dark-secondary">{log.scope}</span>
                  </div>
                  <p className="text-[10px] text-on-dark-secondary mt-0.5">Target: {log.targetId} · {new Date(log.createdAt).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={14} className="text-on-dark-secondary" />
              <h2 className="text-sm font-semibold">Content Performance</h2>
            </div>
            <div className="space-y-2">
              {contentPerf?.map((item: any) => (
                <div key={item.name} className="p-2 bg-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{item.name}</span>
                    <span className="text-[10px] text-on-dark-secondary">{item.views.toLocaleString()} views · {item.time}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={item.share / 100} variant="gold" />
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