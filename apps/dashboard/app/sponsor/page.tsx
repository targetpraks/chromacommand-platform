"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Card, Select, Spinner } from "../components/ui";

/** Read-only sponsor analytics for MTN/FNB partners. */
export default function SponsorPage() {
  const [sponsor, setSponsor] = useState("MTN");
  const { data, isLoading } = trpc.sponsor.getCampaignData.useQuery({ sponsorName: sponsor });

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold flex items-center gap-2"><HeartHandshake size={20} /> Sponsor TakeOver Analytics</h1>
        <p className="text-xs text-on-dark-secondary mt-1">Impressions and activation performance per sponsor campaign.</p>
      </motion.div>

      <div className="mt-4">
        <Select
          value={sponsor}
          onChange={(e: any) => setSponsor(e.target.value)}
          options={[
            { value: "MTN", label: "MTN" },
            { value: "FNB", label: "FNB" },
          ]}
          className="max-w-[200px]"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-[11px] text-on-dark-secondary">Total Impressions (est.)</p>
            <p className="text-lg font-bold mt-0.5">{(data as any)?.summary?.totalImpressions?.toLocaleString() ?? "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] text-on-dark-secondary">Active Stores</p>
            <p className="text-lg font-bold mt-0.5">
              {(data as any)?.summary?.activeStores ?? "—"}<span className="text-sm text-on-dark-secondary">/{(data as any)?.summary?.totalStores ?? "—"}</span>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] text-on-dark-secondary">Avg Dwell (est.)</p>
            <p className="text-lg font-bold mt-0.5">{(data as any)?.summary?.avgDwellMinutes ?? "—"} min</p>
          </Card>
        </div>
      )}
    </div>
  );
}
