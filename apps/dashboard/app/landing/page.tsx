"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Monitor, Volume2, Lightbulb, ArrowRight, Check, BarChart3, Shield } from "lucide-react";
import { useState } from "react";

const FEATURES = [
  {
    icon: Lightbulb,
    title: "RGB LED Control",
    desc: "Per-zone brightness, 8 animation modes, and brand colour presets. One click changes the mood of an entire store.",
  },
  {
    icon: Monitor,
    title: "Screen Playlist Engine",
    desc: "Scheduled content loops, sponsor ad injection, and emergency override. Electron kiosk player on every screen.",
  },
  {
    icon: Volume2,
    title: "Audio Zoning",
    desc: "MPD-based music with per-zone volume, TTS announcements, and automatic music ducking for sponsor spots.",
  },
  {
    icon: Zap,
    title: "One-Button Sync",
    desc: "MTN TakeOver, FNB Late Night, or Native brand mode — press one button and every LED, screen, and speaker follows.",
  },
  {
    icon: Shield,
    title: "Sponsor Dashboard",
    desc: "Read-only analytics for partners: impressions, footfall, QR scans, and time-series engagement graphs.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Telemetry",
    desc: "MQTT sensor pipeline with temperature, humidity, footfall, and energy metrics. Alert on anomaly.",
  },
];

export default function LandingPage() {
  const [stores, setStores] = useState(12);
  const [monthlyPerStore, setMonthlyPerStore] = useState(850);
  const [energySavings, setEnergySavings] = useState(18);

  const totalMonthly = stores * monthlyPerStore;
  const annualSavings = Math.round(totalMonthly * 12 * (energySavings / 100));
  const sponsorRevenue = Math.round(stores * 4500); // R4,500 per store/month sponsor
  const labourHours = Math.round(stores * 4.5); // 4.5 hours saved per store/month

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white">
      <nav className="border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C8A951] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#0A0B14]" />
          </div>
          <span className="font-semibold">ChromaCommand</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-white/50">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#roi" className="hover:text-white transition-colors">ROI Calculator</a>
          <a href="#case-study" className="hover:text-white transition-colors">Case Study</a>
        </div>
        <Link href="/login" className="text-sm px-4 py-2 rounded-lg bg-[#C8A951] text-[#0A0B14] font-semibold hover:bg-[#D4B669] transition-colors">
          Dashboard
        </Link>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <span className="text-[#C8A951] text-xs font-semibold uppercase tracking-[0.2em]">Enterprise IoT for QSR</span>
          <h1 className="text-4xl sm:text-6xl font-bold mt-4 mb-6 tracking-tight">
            One Button.
            <br />
            <span className="text-[#C8A951]">Every Store Transformed.</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
            ChromaCommand controls LED zones, digital screens, and audio across your entire franchise network from a single dashboard. Deploy an MTN TakeOver in 14 hours — not 14 days.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3.5 rounded-lg bg-[#C8A951] text-[#0A0B14] font-semibold hover:bg-[#D4B669] transition-colors inline-flex items-center gap-2">
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#roi" className="px-8 py-3.5 rounded-lg border border-white/20 hover:border-white/40 transition-colors text-sm">
              Calculate ROI
            </a>
          </div>
        </motion.div>
      </section>

      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Platform Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#13141F] border border-white/[0.08] rounded-xl p-6 hover:border-[#C8A951]/30 transition-colors"
            >
              <f.icon className="w-5 h-5 text-[#C8A951] mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="roi" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Franchise ROI Calculator</h2>
        <div className="bg-[#13141F] border border-white/[0.08] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/50">Number of stores</label>
              <input
                type="range" min="1" max="200" value={stores}
                onChange={(e) => setStores(Number(e.target.value))}
                className="w-full mt-2 accent-[#C8A951]"
              />
              <p className="text-[#C8A951] font-mono text-lg mt-1">{stores} stores</p>
            </div>
            <div>
              <label className="text-sm text-white/50">Current monthly environment cost per store (R)</label>
              <input
                type="range" min="200" max="3000" step="50" value={monthlyPerStore}
                onChange={(e) => setMonthlyPerStore(Number(e.target.value))}
                className="w-full mt-2 accent-[#C8A951]"
              />
              <p className="text-[#C8A951] font-mono text-lg mt-1">R{monthlyPerStore.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm text-white/50">Energy savings with smart LED + scheduling (%)</label>
              <input
                type="range" min="5" max="40" value={energySavings}
                onChange={(e) => setEnergySavings(Number(e.target.value))}
                className="w-full mt-2 accent-[#C8A951]"
              />
              <p className="text-[#C8A951] font-mono text-lg mt-1">{energySavings}%</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08]">
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider">Annual Savings</p>
              <p className="text-2xl font-bold text-[#C8A951] mt-1">R{annualSavings.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider">Sponsor Revenue</p>
              <p className="text-2xl font-bold text-[#C8A951] mt-1">R{sponsorRevenue.toLocaleString()}/mo</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider">Labour Hours Saved</p>
              <p className="text-2xl font-bold text-[#C8A951] mt-1">{labourHours}h/mo</p>
            </div>
          </div>
        </div>
      </section>

      <section id="case-study" className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-[#13141F] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <span className="text-[#C8A951] text-xs font-semibold uppercase tracking-[0.2em]">Case Study</span>
            <h2 className="text-2xl font-bold mt-2 mb-4">Papa Pasta Sandton — MTN TakeOver</h2>
            <p className="text-white/50 mb-6">
              ChromaCommand deployed across 3 Papa Pasta locations for an MTN TakeOver campaign. One-Button Sync changed every store from daytime Native brand mode to MTN brand colours and audio in 14 hours.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Deployment Time", value: "14h" },
                { label: "Energy Savings", value: "18%" },
                { label: "Sponsor Revenue", value: "R13,500" },
                { label: "Tech Time Saved", value: "12h/mo" },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#0A0B14] rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-[#C8A951]">{stat.value}</p>
                  <p className="text-xs text-white/40 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                "LED zones synced to MTN yellow across all 3 stores simultaneously",
                "Screen playlists injected with MTN promotional content automatically",
                "Audio zones switched to curated MTN brand music + TTS announcements",
                "Sponsor dashboard gave MTN real-time impression and footfall data",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-white/50">
                  <Check className="w-4 h-4 text-[#C8A951] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#C8A951] flex items-center justify-center">
              <Zap className="w-3 h-3 text-[#0A0B14]" />
            </div>
            <span className="text-sm font-semibold">ChromaCommand</span>
          </div>
          <p className="text-xs text-white/30">© 2026 Infinity Brands. Built in Cape Town.</p>
        </div>
      </footer>
    </div>
  );
}
