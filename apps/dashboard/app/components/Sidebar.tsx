"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Grid, Monitor, Music, Settings, Zap, BarChart3, LayoutGrid, LogOut, HeartHandshake, Radio, Calendar } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { label: "Matrix", icon: LayoutGrid, href: "/", badge: null },
  { label: "Stores", icon: Grid, href: "/stores", badge: null },
  { label: "Content", icon: Monitor, href: "/content", badge: null },
  { label: "Audio", icon: Music, href: "/audio", badge: null },
  { label: "Sync", icon: Zap, href: "/sync", badge: null },
  { label: "Schedules", icon: Calendar, href: "/schedules", badge: "NEW" },
  { label: "Analytics", icon: BarChart3, href: "/analytics", badge: null },
  { label: "Sponsor", icon: HeartHandshake, href: "/sponsor", badge: "NEW" },
  { label: "Settings", icon: Settings, href: "/settings", badge: null },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 h-screen w-[240px] bg-panel border-r border-border flex flex-col z-50"
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-navy to-[#0d1a35] border border-gold/20 flex items-center justify-center">
            <span className="text-gold font-bold text-sm">CC</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight">ChromaCommand</h1>
            <p className="text-[10px] text-text-secondary">Papa Pasta Control Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer mb-0.5 ${
                  isActive
                    ? "bg-gold/10 text-gold"
                    : "text-text-secondary hover:text-white hover:bg-panel-hover"
                }`}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded">{item.badge}</span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-navy border border-gold/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-gold">RM</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Ricardo Maio</p>
            <p className="text-[10px] text-text-secondary">HQ Admin</p>
          </div>
          <LogOut size={16} className="text-text-secondary cursor-pointer hover:text-white" />
        </div>
      </div>
    </motion.aside>
  );
}
