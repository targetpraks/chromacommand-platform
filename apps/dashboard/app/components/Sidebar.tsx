"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Grid, Monitor, Music, Settings, Zap, BarChart3, LayoutGrid, LogOut, HeartHandshake, Calendar, Cpu, Bell, Music2, Menu, X, SlidersHorizontal, ListChecks, Boxes } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "./ui";

const navItems = [
  { label: "Master Control", icon: SlidersHorizontal, href: "/control", badge: "CORE" },
  { label: "Matrix", icon: LayoutGrid, href: "/", badge: null as string | null },
  { label: "Stores", icon: Grid, href: "/stores", badge: null },
  { label: "Fleet", icon: Boxes, href: "/fleet", badge: "NEW" },
  { label: "Commands", icon: ListChecks, href: "/commands", badge: "NEW" },
  { label: "Content", icon: Monitor, href: "/content", badge: null },
  { label: "Audio", icon: Music, href: "/audio", badge: null },
  { label: "Spotify", icon: Music2, href: "/spotify", badge: null },
  { label: "Sync", icon: Zap, href: "/sync", badge: null },
  { label: "Schedules", icon: Calendar, href: "/schedules", badge: null },
  { label: "Firmware", icon: Cpu, href: "/firmware", badge: null },
  { label: "Alerts", icon: Bell, href: "/alerts", badge: "NEW" },
  { label: "Analytics", icon: BarChart3, href: "/analytics", badge: null },
  { label: "Sponsor", icon: HeartHandshake, href: "/sponsor", badge: null },
  { label: "Settings", icon: Settings, href: "/settings", badge: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} onClick={onClick}>
            <motion.div
              whileHover={{ x: 2 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer mb-0.5 ${
                isActive
                  ? "bg-gold/10 text-gold"
                  : "text-on-dark-secondary hover:text-on-dark hover:bg-panel-hover"
              }`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="font-medium">{item.label}</span>
              {item.badge && <Badge variant="new" className="ml-auto">{item.badge}</Badge>}
            </motion.div>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-panel border-b border-border-medium flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-navy/50 border border-gold/20 flex items-center justify-center">
            <span className="text-gold font-bold text-xs">CC</span>
          </div>
          <div>
            <h1 className="font-bold text-on-dark text-sm leading-tight">ChromaCommand</h1>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-on-dark-secondary hover:text-on-dark hover:bg-panel-hover transition"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-[60] w-[260px] bg-panel border-r border-border-medium flex flex-col lg:hidden"
            >
              <div className="px-5 py-4 border-b border-border-medium flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-navy/50 border border-gold/20 flex items-center justify-center">
                    <span className="text-gold font-bold text-xs">CC</span>
                  </div>
                  <div>
                    <h1 className="font-bold text-on-dark text-sm">ChromaCommand</h1>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-md text-on-dark-secondary hover:text-on-dark hover:bg-panel-hover transition"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 py-3 px-3 overflow-y-auto">
                <NavList onClick={() => setMobileOpen(false)} />
              </nav>

              <div className="p-3 border-t border-border-medium">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-navy border border-gold/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gold">RM</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-on-dark truncate">Ricardo Maio</p>
                    <p className="text-[10px] text-on-dark-secondary">HQ Admin</p>
                  </div>
                  <LogOut size={16} className="text-on-dark-secondary cursor-pointer hover:text-on-dark transition" />
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        initial={{ x: -240 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
        className="hidden lg:flex fixed left-0 top-0 h-screen w-[240px] bg-panel border-r border-border-medium flex-col z-40"
      >
        <div className="px-5 py-5 border-b border-border-medium">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-navy to-navy/50 border border-gold/20 flex items-center justify-center">
              <span className="text-gold font-bold text-sm">CC</span>
            </div>
            <div>
              <h1 className="font-bold text-on-dark text-sm leading-tight">ChromaCommand</h1>
              <p className="text-[10px] text-on-dark-secondary">Papa Pasta Control Hub</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3">
          <NavList />
        </nav>

        <div className="p-3 border-t border-border-medium">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-navy border border-gold/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-gold">RM</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-on-dark truncate">Ricardo Maio</p>
              <p className="text-[10px] text-on-dark-secondary">HQ Admin</p>
            </div>
            <LogOut size={16} className="text-on-dark-secondary cursor-pointer hover:text-on-dark transition" />
          </div>
        </div>
      </motion.aside>
    </>
  );
}
