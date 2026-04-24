"use client";

import { motion } from "framer-motion";
import { Monitor, Upload, Image as ImageIcon, FileCode, Film } from "lucide-react";
import { trpc } from "../lib/trpc";

export default function ContentPage() {
  const { data: assets, isLoading } = trpc.content.listAssets.useQuery();

  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Content Manager</h1>
            <p className="text-xs text-text-secondary mt-1">Manage menu boards, promos, and sponsor assets</p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gold text-navy rounded-lg hover:bg-gold/90">
            <Upload size={14} /> Upload Asset
          </button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets?.map((asset: any, i: number) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="bg-panel rounded-xl border border-border p-4 hover:border-gold/20 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-dark border border-white/5 flex items-center justify-center shrink-0">
                  {asset.type === "template" ? <FileCode size={18} className="text-gold" /> :
                   asset.type === "image" || asset.type === "html" ? <ImageIcon size={18} className="text-blue-400" /> :
                   <Film size={18} className="text-purple-400" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{asset.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
                    <span className="capitalize">{asset.type}</span>
                    <span>·</span>
                    <span>{asset.durationSeconds}s</span>
                    <span>·</span>
                    <span>priority {asset.priority}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 py-1.5 text-[10px] bg-dark border border-border rounded-lg hover:bg-panel-hover">Preview</button>
                <button className="flex-1 py-1.5 text-[10px] bg-dark border border-border rounded-lg hover:bg-panel-hover">Assign</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
