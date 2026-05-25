"use client";

import { useState, useEffect } from "react";
import { X, Info } from "lucide-react";

const DEMO_BANNER_KEY = "cc_demo_banner_dismissed";

export function DemoModeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DEMO_BANNER_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage unavailable (e.g. private mode)
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="relative mx-6 mt-4 rounded-lg border border-warning/20 bg-warning-subtle px-4 py-2.5 text-xs text-warning flex items-start gap-3">
      <Info size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Demo Mode</p>
        <p className="opacity-80 mt-0.5">Data is simulated. Connect a store to see live data.</p>
      </div>
      <button
        onClick={() => {
          setVisible(false);
          try { localStorage.setItem(DEMO_BANNER_KEY, "1"); } catch {}
        }}
        className="text-warning/70 hover:text-warning transition shrink-0"
        aria-label="Dismiss demo banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
