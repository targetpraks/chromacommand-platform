"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, MousePointerClick, Zap, CalendarDays, X } from "lucide-react";

const ONBOARDING_KEY = "cc_onboarding_seen";

const steps = [
  {
    icon: LayoutGrid,
    title: "This is the Matrix",
    description: "Your store command centre. See every location, zone colour, and status at a glance.",
  },
  {
    icon: MousePointerClick,
    title: "Click a Store",
    description: "Dive into zones, RGB controls, screen content, and audio for any store.",
  },
  {
    icon: Zap,
    title: "One-Button Sync",
    description: "Use Sync to push colours, content, or audio to all stores instantly.",
  },
  {
    icon: CalendarDays,
    title: "Schedule Ahead",
    description: "Set content and lighting to auto-play at specific times — even overnight.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25 }}
            className="fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg"
          >
            <div className="bg-panel border border-border-strong rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-on-dark">Welcome to ChromaCommand</h2>
                  <p className="text-xs text-on-dark-secondary mt-1">A quick tour of your control hub</p>
                </div>
                <button onClick={dismiss} className="text-on-dark-secondary hover:text-on-dark transition" aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-dark/50 border border-border-medium">
                    <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center shrink-0">
                      <step.icon size={16} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-dark">{step.title}</p>
                      <p className="text-xs text-on-dark-secondary mt-0.5 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={dismiss}
                  className="text-xs text-on-dark-secondary hover:text-on-dark transition px-3 py-2 rounded-md hover:bg-panel-hover"
                >
                  Skip
                </button>
                <button
                  onClick={dismiss}
                  className="text-xs font-semibold bg-gold text-navy px-4 py-2 rounded-md hover:bg-gold-hover transition"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
