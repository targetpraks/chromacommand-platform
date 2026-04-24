"use client";

import { motion } from "framer-motion";
import { Monitor, Upload, Image, FileCode, Film } from "lucide-react";

export default function ContentPage() {
  const assets = [
    { id: "asset_menu_v1", name: "Standard Menu", type: "template", updated: "2h ago", size: "12KB" },
    { id: "asset_mtn_promo", name: "MTN TakeOver Promo", type: "image", updated: "1d ago", size: "2.4MB" },
    { id: "asset_fnb_logo", name: "FNB Logo Sheet", type: "image", updated: "3d ago", size: "890KB" },
    { id: "asset_combo_deal", name: "Combo Deal Board", type: "template", updated: "1w ago", size: "8KB" },
    { id: "asset_late_night", name: "Late Night Menu", type: "template", updated: "2w ago", size: "10KB" },
  ];

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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {assets.map((asset, i) => (
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
                 asset.type === "image" ? <Image size={18} className="text-blue-400" /> :
                 <Film size={18} className="text-purple-400" />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium">{asset.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
                  <span className="capitalize">{asset.type}</span>
                  <span>·</span>
                  <span>{asset.size}</span>
                  <span>·</span>
                  <span>{asset.updated}</span>
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
    </div>
  );
}
