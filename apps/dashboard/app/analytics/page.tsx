"use client";

import { motion } from "framer-motion";
import { TrendingUp, Eye, Footprints, QrCode, Clock } from "lucide-react";

export default function AnalyticsPage() {
  const stats = [
    { label: "Total Impressions Today", value: "12,847", change: "+8.2%", colour: "bg-gold/10 text-gold" },
    { label: "Footfall", value: "3,421", change: "+12.1%", colour: "bg-green-500/10 text-green-400" },
    { label: "QR Scans", value: "892", change: "+23.4%", colour: "bg-blue-500/10 text-blue-400" },
    { label: "Avg Dwell Time", value: "14 min", change: "+2 min", colour: "bg-purple-500/10 text-purple-400" },
  ];

  const hourly = [12, 45, 120, 210, 340, 890, 1200, 1350, 1100, 950, 800, 650, 500, 420, 380, 420, 560, 780, 920, 850, 640, 340, 120, 45];
  const max = Math.max(...hourly);

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Analytics</h1>
        <p className="text-xs text-text-secondary mt-1">Real-time data from across the franchise network</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className={`${stat.colour} p-4 rounded-xl`}
          >
            <p className="text-[10px] font-medium opacity-70">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{stat.change} vs yesterday</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly footfall */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Footprints size={14} className="text-text-secondary" />
              <h2 className="text-sm font-semibold">Hourly Footfall — PP-A01</h2>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-40">
            {hourly.map((v, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(v / max) * 100}%` }}
                transition={{ delay: 0.3 + i * 0.01, duration: 0.4 }}
                className="flex-1 bg-gold/50 rounded-t"
                style={{ minWidth: 2 }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-secondary">
            <span>00:00</span><span>12:00</span><span>23:00</span>
          </div>
        </motion.div>

        {/* Content performance */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={14} className="text-text-secondary" />
            <h2 className="text-sm font-semibold">Content Performance</h2>
          </div>
          <div className="space-y-2">
            {[
              { name: "Standard Menu", views: 3421, time: "8.5 min", share: 45 },
              { name: "MTN TakeOver Promo", views: 2100, time: "6.2 min", share: 30 },
              { name: "Combo Deal Board", views: 1800, time: "4.1 min", share: 25 },
            ].map((item) => (
              <div key={item.name} className="p-2 bg-dark rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs">{item.name}</span>
                  <span className="text-[10px] text-text-secondary">{item.views.toLocaleString()} views · {item.time}</span>
                </div>
                <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full" style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
