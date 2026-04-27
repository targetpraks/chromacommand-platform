"use client";

import { motion } from "framer-motion";
import { User, Building2, Shield, Bell, Palette, Globe } from "lucide-react";
import { LogoutButton } from "../components/LogoutButton";

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-xs text-text-secondary mt-1">Configure your ChromaCommand environment</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <User size={16} />
            <h2 className="text-sm font-semibold">Your Profile</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-navy border border-gold/20 flex items-center justify-center">
              <span className="text-lg font-semibold text-gold">RM</span>
            </div>
            <div>
              <p className="text-sm font-medium">Ricardo Maio</p>
              <p className="text-[10px] text-text-secondary">HQ Admin · Infinity Brands</p>
              <p className="text-[10px] text-text-secondary">ricardo@infxmedia.xyz</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <LogoutButton />
            <LogoutButton all />
          </div>
        </motion.div>

        {/* Org Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <Building2 size={16} />
            <h2 className="text-sm font-semibold">Organization</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-text-secondary">Org Name</label>
              <div className="mt-1 px-3 py-1.5 bg-dark rounded-lg text-sm">Papa Pasta Franchising (PTY) Ltd</div>
            </div>
            <div>
              <label className="text-[10px] text-text-secondary">Timezone</label>
              <div className="mt-1 px-3 py-1.5 bg-dark rounded-lg text-sm">Africa/Johannesburg (SAST)</div>
            </div>
          </div>
        </motion.div>

        {/* Roles */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={16} />
            <h2 className="text-sm font-semibold">Role Management</h2>
          </div>
          <div className="space-y-2">
            {[
              { role: "HQ Admin", users: 1, access: "Everything" },
              { role: "Regional Manager", users: 2, access: "Cape Town, Johannesburg" },
              { role: "Franchisee", users: 3, access: "Own store only" },
              { role: "Sponsor Viewer", users: 0, access: "Read-only TakeOver data" },
            ].map((r) => (
              <div key={r.role} className="flex items-center justify-between p-2 bg-dark rounded-lg">
                <div>
                  <p className="text-xs font-medium">{r.role}</p>
                  <p className="text-[10px] text-text-secondary">{r.access}</p>
                </div>
                <span className="text-[10px] text-text-secondary">{r.users} users</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-panel rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={16} />
            <h2 className="text-sm font-semibold">Notifications</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: "Store goes offline", enabled: true },
              { label: "Screen disconnects", enabled: true },
              { label: "TakeOver expires in 24h", enabled: true },
              { label: "LED controller fault", enabled: false },
              { label: "Franchisee override", enabled: true },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between p-2">
                <span className="text-xs">{n.label}</span>
                <div className={`w-8 h-4 rounded-full transition ${n.enabled ? "bg-gold" : "bg-white/10"}`}>
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition ${n.enabled ? "ml-4" : "ml-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
