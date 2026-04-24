import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../lib/trpc";
import { motion } from "framer-motion";
import {
  Store, Eye, Users, QrCode, TrendingUp, MapPin,
  Palette, Monitor, Activity, Calendar, Clock,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";

function StatCard({
  label, value, change, icon: Icon,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const up = change?.startsWith("+");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-panel border border-border rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={20} className="text-gold" />
        {change && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-green-400" : "text-red-400"}`}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </motion.div>
  );
}

export default function SponsorPage() {
  const { data: campaign, isLoading } = trpc.sponsor.getCampaignData.useQuery({
    sponsorName: "MTN",
    period: "week",
  });

  const { data: timeSeries } = trpc.sponsor.getTimeSeries.useQuery({
    sponsorName: "MTN",
    period: "week",
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-text-secondary">
        Loading sponsor analytics...
      </div>
    );
  }

  const summary = campaign?.summary;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">MTN TakeOver Sponsorship</h1>
          <p className="text-sm text-text-secondary">
            {campaign?.period} report · {summary?.totalStores} stores · {summary?.activeStores} active
          </p>
        </div>
        <div className="flex gap-2">
          {["today", "week", "month"].map((p) => (
            <button
              key={p}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                campaign?.period === p
                  ? "bg-gold text-navy-dark"
                  : "bg-panel border border-border text-text-secondary hover:text-white"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Impressions" value={summary?.totalImpressions.toLocaleString() ?? "—"} change="+12.4%" icon={Eye} />
        <StatCard label="Footfall" value={summary?.totalFootfall.toLocaleString() ?? "—"} change="+8.2%" icon={Users} />
        <StatCard label="QR Scans" value={summary?.totalQRScans.toLocaleString() ?? "—"} change="+23.1%" icon={QrCode} />
        <StatCard label="Conversion Rate" value={`${summary?.conversionRate ?? "—"}%`} change="+1.8%" icon={TrendingUp} />
      </div>

      {/* Store-level breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-panel border border-border rounded-xl"
      >
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Store Performance</h2>
        </div>
        <div className="divide-y divide-border">
          {campaign?.storeStats.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 hover:bg-panel-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: store.activeColour }}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{store.name}</p>
                    <p className="text-xs text-text-secondary flex items-center gap-1">
                      <MapPin size={10} /> {store.region}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium text-white">{store.impressions.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary">impressions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{store.footfall.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary">footfall</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{store.qrScans.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary">QR scans</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Monitor size={12} /> {store.screenOnline}/{store.screenCount}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Time series chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-panel border border-border rounded-xl p-4"
      >
        <h2 className="text-sm font-semibold text-white mb-4">Impressions Over Time</h2>
        <div className="flex items-end gap-3 h-40">
          {timeSeries?.map((point, i) => {
            const max = Math.max(...(timeSeries.map((d: any) => d.impressions) ?? []));
            const height = max ? (point.impressions / max) * 100 : 50;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gold/30 rounded-t-sm transition-all hover:bg-gold/50"
                  style={{ height: `${height}%` }}
                />
                <p className="text-[10px] text-text-secondary">{point.date.slice(-2)}</p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Activity feed */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-panel border border-border rounded-xl"
      >
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {campaign?.activity.slice(0, 10).map((act: any) => (
            <div key={act.id} className="p-3 flex items-center gap-3 text-sm">
              <Activity size={14} className="text-gold/60" />
              <div className="flex-1">
                <p className="text-white">
                  {act.action.replace(/_/g, " ")} on {act.targetId}
                </p>
                <p className="text-xs text-text-secondary">
                  {new Date(act.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
