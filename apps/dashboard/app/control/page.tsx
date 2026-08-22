"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown, ChevronRight, Globe, Lightbulb, Music, Monitor, Sparkles,
  Play, Pause, SkipForward, VolumeX, Volume2, Mic, AlertTriangle, Eye,
  Power, PowerOff, Send, Eraser, RotateCw,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { Card, Button, Badge, StatusDot, Spinner, Input, Select, TextArea } from "../components/ui";

// ─── Selection model ──────────────────────────────────────────────────────
type ScopeLevel = "global" | "country" | "province" | "region" | "store";
interface Selection {
  scope: ScopeLevel;
  targetId: string;
  label: string;
  storeId?: string; // set when a concrete store is picked (enables per-zone/per-screen control)
}

const RGB_MODES = ["solid", "gradient", "pulse", "chase", "breath", "sparkle", "wave", "rainbow"];
const TABS = [
  { id: "lighting", label: "Lighting", icon: Lightbulb },
  { id: "music", label: "Music", icon: Music },
  { id: "kiosks", label: "Kiosks", icon: Monitor },
  { id: "scenes", label: "Scenes", icon: Sparkles },
] as const;

export default function ControlPage() {
  const [selection, setSelection] = useState<Selection>({ scope: "global", targetId: "all", label: "Entire Network" });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("lighting");
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const { data: tree, isLoading } = trpc.hierarchy.tree.useQuery();

  return (
    <div className="min-h-screen flex">
      {/* ── Hierarchy tree ── */}
      <aside className="hidden xl:flex flex-col w-[300px] shrink-0 border-r border-border-medium bg-panel/50">
        <div className="px-4 py-4 border-b border-border-medium">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Globe size={15} /> Network Hierarchy</h2>
          <p className="text-[10px] text-on-dark-secondary mt-0.5">Pick what you control — everything below applies to this scope.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {isLoading ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : (
            <button
              onClick={() => setSelection({ scope: "global", targetId: "all", label: "Entire Network" })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${selection.scope === "global" ? "bg-gold/10 text-gold" : "hover:bg-panel-hover"}`}
            >
              🌍 Entire Network
            </button>
          )}
          {tree?.map((country) => (
            <CountryNode key={country.id} country={country} selection={selection} onSelect={setSelection} />
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 px-6 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">Master Control</h1>
              <p className="text-xs text-on-dark-secondary mt-1">
                Controlling: <span className="text-gold font-medium">{selection.label}</span>
                <Badge variant="new" className="ml-2">{selection.scope}</Badge>
              </p>
            </div>
            <Button variant="danger" onClick={() => setEmergencyOpen(true)}>
              <AlertTriangle size={13} /> Emergency Broadcast
            </Button>
          </div>

          <div className="mt-4 flex gap-1 border-b border-border-medium">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition ${
                  tab === t.id ? "border-gold text-gold" : "border-transparent text-on-dark-secondary hover:text-on-dark"
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "lighting" && <LightingTab selection={selection} />}
            {tab === "music" && <MusicTab selection={selection} />}
            {tab === "kiosks" && <KioskTab selection={selection} />}
            {tab === "scenes" && <ScenesTab selection={selection} />}
          </div>
        </motion.div>
      </main>

      {emergencyOpen && <EmergencyModal selection={selection} onClose={() => setEmergencyOpen(false)} />}
    </div>
  );
}

// ─── Tree nodes ───────────────────────────────────────────────────────────
function CountryNode({ country, selection, onSelect }: any) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-panel-hover">
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="font-medium">{country.name}</span>
      </button>
      {open && country.provinces.map((province: any) => (
        <ProvinceNode key={province.id} province={province} countryId={country.id} selection={selection} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ProvinceNode({ province, countryId, selection, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const storeCount = province.cities.reduce((n: number, c: any) => n + c.stores.length, 0);
  return (
    <div className="ml-3">
      <button
        onClick={() => setOpen(!open)}
        onDoubleClick={() => onSelect({ scope: "province", targetId: province.id, label: `${province.name} (Province)`, storeId: undefined })}
        title="Double-click to select"
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition ${
          selection.scope === "province" && selection.targetId === province.id ? "bg-gold/10 text-gold" : "hover:bg-panel-hover"
        }`}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{province.name}</span>
        <span className="ml-auto text-[10px] text-on-dark-secondary">{storeCount}</span>
      </button>
      {open && (
        <>
          <button
            onClick={() => onSelect({ scope: "province", targetId: province.id, label: `${province.name} (Province)` })}
            className="block w-full text-left ml-4 px-2 py-0.5 text-[10px] text-gold/70 hover:text-gold"
          >
            ● control whole province
          </button>
          {province.cities.map((city: any) => (
            <CityNode key={city.id} city={city} countryId={countryId} provinceId={province.id} selection={selection} onSelect={onSelect} />
          ))}
        </>
      )}
    </div>
  );
}

function CityNode({ city, countryId, provinceId, selection, onSelect }: any) {
  const [open, setOpen] = useState(city.stores.length <= 4);
  return (
    <div className="ml-3">
      <button
        onClick={() => setOpen(!open)}
        onDoubleClick={() => onSelect({ scope: "region", targetId: city.id, label: `${city.name} (City)` })}
        title="Double-click to select city"
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition ${
          selection.scope === "region" && selection.targetId === city.id ? "bg-gold/10 text-gold" : "hover:bg-panel-hover"
        }`}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{city.name}</span>
        <span className="ml-auto text-[10px] text-on-dark-secondary">{city.stores.length}</span>
      </button>
      {open && (
        <>
          <button
            onClick={() => onSelect({ scope: "region", targetId: city.id, label: `${city.name} (City)` })}
            className="block w-full text-left ml-4 px-2 py-0.5 text-[10px] text-gold/70 hover:text-gold"
          >
            ● control whole city
          </button>
          {city.stores.map((store: any) => (
            <button
              key={store.id}
              onClick={() =>
                onSelect({ scope: "store", targetId: store.id, label: store.name, storeId: store.id })
              }
              className={`w-full flex items-center gap-2 ml-4 px-2 py-1.5 rounded-lg text-xs transition ${
                selection.targetId === store.id ? "bg-gold/10 text-gold" : "hover:bg-panel-hover text-on-dark-secondary"
              }`}
            >
              <StatusDot status={store.status === "online" ? "online" : "offline"} />
              <span className="truncate">{store.name}</span>
              <span className="ml-auto text-[9px] text-on-dark-secondary shrink-0">{store.counts.devicesOnline}/{store.counts.devices}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Lighting tab ─────────────────────────────────────────────────────────
function LightingTab({ selection }: { selection: Selection }) {
  const utils = trpc.useUtils();
  const [colour, setColour] = useState("#FFD100");
  const [secondary, setSecondary] = useState("#CBA135");
  const [mode, setMode] = useState("solid");
  const [brightness, setBrightness] = useState(0.85);
  const [speed, setSpeed] = useState(1);
  const [fadeMs, setFadeMs] = useState(1000);
  const [zone, setZone] = useState("all");
  const [segmentsOn, setSegmentsOn] = useState(false);
  const [segA, setSegA] = useState("#FFFFFF");

  const { data: storeState } = trpc.rgb.getState.useQuery(
    { storeId: selection.storeId! },
    { enabled: !!selection.storeId }
  );

  const setMutation = trpc.rgb.set.useMutation({
    onSuccess: () => utils.rgb.getState.invalidate(),
  });
  const blackoutMutation = trpc.rgb.blackout.useMutation();
  const identifyMutation = trpc.rgb.identify.useMutation();

  const zoneOptions = useMemo(() => {
    if (!selection.storeId || !storeState) return [{ value: "all", label: "All zones in scope" }];
    return [
      { value: "all", label: `All zones — ${storeState.zones.length}` },
      ...storeState.zones.map((z: any) => ({ value: z.id, label: z.displayName })),
    ];
  }, [selection.storeId, storeState]);

  const apply = () => {
    if (selection.scope === "store" && !selection.storeId) return;
    setMutation.mutate({
      scope: selection.scope as any,
      targetId: selection.targetId,
      ...(zone !== "all" && selection.storeId ? { zone } : {}),
      colour: { mode: mode as any, primary: colour, secondary, brightness, speed },
      fadeMs,
      ...(segmentsOn
        ? {
            segments: [
              ...(storeState?.zones.find((z: any) => z.id === zone)?.segments ?? []).map((s: any, i: number) => ({
                name: s.name ?? `seg-${i}`,
                startIndex: s.startIndex,
                endIndex: s.endIndex,
                primary: i === 0 ? segA : colour,
              })),
            ],
          }
        : {}),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Lightbulb size={15} /> Lighting Command</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="cc-input-label">Primary</span>
            <input type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="cc-input h-10 p-1 cursor-pointer" />
          </label>
          <label className="block">
            <span className="cc-input-label">Secondary</span>
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="cc-input h-10 p-1 cursor-pointer" />
          </label>
          <Select label="Effect" value={mode} onChange={(e: any) => setMode(e.target.value)} options={RGB_MODES.map((m) => ({ value: m, label: m }))} />
          <Select label="Zone" value={zone} onChange={(e: any) => setZone(e.target.value)} options={zoneOptions} disabled={!selection.storeId && zone !== "all"} />
          <label className="block">
            <span className="cc-input-label">Brightness — {Math.round(brightness * 100)}%</span>
            <input type="range" min={0} max={1} step={0.05} value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full accent-gold" />
          </label>
          <label className="block">
            <span className="cc-input-label">Speed ×{speed.toFixed(1)}</span>
            <input type="range" min={0.1} max={5} step={0.1} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full accent-gold" />
          </label>
          <Input label="Fade (ms)" type="number" value={fadeMs} min={0} max={30000} step={100} onChange={(e: any) => setFadeMs(parseInt(e.target.value || "0"))} />
        </div>

        {selection.storeId && (
          <label className="flex items-center gap-2 mt-3 text-xs text-on-dark-secondary">
            <input type="checkbox" checked={segmentsOn} onChange={(e) => setSegmentsOn(e.target.checked)} className="accent-gold" />
            Paint per-segment colours (first segment uses accent below)
          </label>
        )}
        {segmentsOn && (
          <div className="mt-2 w-24">
            <span className="cc-input-label">Segment accent</span>
            <input type="color" value={segA} onChange={(e) => setSegA(e.target.value)} className="cc-input h-8 p-1 cursor-pointer" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={apply} disabled={setMutation.isPending}>
            <Send size={12} /> Apply to {selection.label}
          </Button>
          <Button variant="ghost" onClick={() => { setColour("#1B2A4A"); setMode("solid"); setBrightness(0.85); }}>
            Brand Default
          </Button>
          <Button variant="danger" onClick={() => blackoutMutation.mutate({ scope: selection.scope as any, targetId: selection.targetId })}>
            <PowerOff size={12} /> Blackout
          </Button>
          {selection.storeId && zone !== "all" && (
            <Button variant="ghost" onClick={() => identifyMutation.mutate({ zoneId: zone })}>
              <Eye size={12} /> Identify zone
            </Button>
          )}
        </div>
        {(setMutation.data || setMutation.error) && (
          <p className="mt-2 text-[11px]">
            {setMutation.data && <span className="text-success">Dispatched {setMutation.data.commandId} → {setMutation.data.targets} store(s). </span>}
            {setMutation.error && <span className="text-error">{setMutation.error.message}</span>}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Live Zone State</h3>
        {!selection.storeId ? (
          <p className="text-xs text-on-dark-secondary">Pick a specific store in the tree to see per-zone state.</p>
        ) : !storeState ? (
          <Spinner />
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {storeState.zones.map((z: any) => (
              <div key={z.id} className="flex items-center gap-3 p-2 bg-dark rounded-lg">
                <div className="w-7 h-7 rounded-md border border-white/10 shrink-0" style={{ background: z.colour }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{z.displayName}</p>
                  <p className="text-[10px] text-on-dark-secondary">{z.mode} · {Math.round((z.brightness ?? 0) * 100)}% · {z.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Music tab ────────────────────────────────────────────────────────────
const AUDIO_ZONE_TYPES = ["dining", "pickup", "exterior", "back-of-house"] as const;

function MusicTab({ selection }: { selection: Selection }) {
  const utils = trpc.useUtils();
  const audio = trpc.audio.set.useMutation({ onSuccess: () => utils.audio.getZoneState.invalidate() });
  const announce = trpc.audio.announce.useMutation();
  const [announceText, setAnnounceText] = useState("");
  const [announceZones, setAnnounceZones] = useState<string[]>(["dining"]);

  const { data: zones } = trpc.audio.getZoneState.useQuery(
    { storeId: selection.storeId! },
    { enabled: !!selection.storeId }
  );
  const { data: playlists } = trpc.audio.listPlaylists.useQuery();

  const act = (zoneType: string, action: string, extra: Record<string, unknown> = {}) =>
    audio.mutate({ scope: selection.scope as any, targetId: selection.targetId, zone: zoneType as any, action: action as any, ...extra });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {!selection.storeId ? (
          <Card className="p-4">
            <p className="text-xs text-on-dark-secondary">
              Bulk transport applies to <b>{selection.label}</b> across all its stores.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="primary" onClick={() => AUDIO_ZONE_TYPES.forEach((z) => act(z, "play"))}><Play size={12} /> Play all zones</Button>
              <Button onClick={() => AUDIO_ZONE_TYPES.forEach((z) => act(z, "pause"))}><Pause size={12} /> Pause all</Button>
              <Button onClick={() => AUDIO_ZONE_TYPES.forEach((z) => act(z, "stop"))}><PowerOff size={12} /> Stop all</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Music size={15} /> Zones</h3>
            <div className="space-y-3">
              {(zones ?? []).map((z: any) => (
                <ZoneTransport key={z.id} zone={z} act={act} />
              ))}
              {(zones ?? []).length === 0 && <p className="text-xs text-on-dark-secondary">No audio zones registered for this store yet.</p>}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mic size={15} /> PA Announcement</h3>
          <TextArea rows={2} placeholder="Announcement text…" value={announceText} onChange={(e: any) => setAnnounceText(e.target.value)} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {AUDIO_ZONE_TYPES.map((z) => (
              <button
                key={z}
                onClick={() => setAnnounceZones((prev) => prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z])}
                className={`px-2 py-1 rounded-md text-[11px] border transition ${announceZones.includes(z) ? "border-gold text-gold bg-gold/10" : "border-border-medium text-on-dark-secondary"}`}
              >
                {z}
              </button>
            ))}
            <Button
              variant="primary"
              className="ml-auto"
              disabled={!announceText || announceZones.length === 0}
              onClick={() => announce.mutate({
                scope: selection.scope as any,
                targetId: selection.targetId,
                zones: announceZones as any,
                text: announceText,
                duckMusic: true,
                priority: 5,
              }, { onSuccess: () => setAnnounceText("") })}
            >
              Announce to {selection.label}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Music Library</h3>
        <div className="space-y-2">
          {(playlists ?? []).map((pl: any) => (
            <div key={pl.id} className="flex items-center gap-3 p-2 bg-dark rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{pl.name}</p>
                <p className="text-[10px] text-on-dark-secondary truncate">{(pl.tags ?? []).join(", ")}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => audio.mutate({ scope: selection.scope as any, targetId: selection.targetId, zone: "dining", action: "play", playlistId: pl.id, source: "local" })}
              >
                <Play size={11} />
              </Button>
            </div>
          ))}
          {(playlists ?? []).length === 0 && <p className="text-xs text-on-dark-secondary">No playlists yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function ZoneTransport({ zone, act }: { zone: any; act: (zone: string, action: string, extra?: Record<string, unknown>) => void }) {
  const playing = zone.status === "playing" || zone.status === "online";
  const [vol, setVol] = useState(zone.volume ?? 0.5);

  return (
    <div className="p-3 bg-dark rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusDot status={playing ? "online" : "offline"} />
          <p className="text-sm font-medium capitalize">{zone.zoneType}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => act(zone.zoneType, playing ? "pause" : "play")}>
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </Button>
          <Button variant="ghost" onClick={() => act(zone.zoneType, "skip")}><SkipForward size={12} /></Button>
          <Button variant="ghost" onClick={() => act(zone.zoneType, mutedNow(vol) ? "unmute" : "mute")}>
            {mutedNow(vol) ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={0} max={1} step={0.05} value={vol}
          onChange={(e) => setVol(parseFloat(e.target.value))}
          onMouseUp={() => act(zone.zoneType, "volume", { volume: vol })}
          onTouchEnd={() => act(zone.zoneType, "volume", { volume: vol })}
          className="flex-1 accent-gold"
        />
        <span className="text-[10px] text-on-dark-secondary w-8 text-right">{Math.round(vol * 100)}%</span>
      </div>
    </div>
  );
}

function mutedNow(v: number) {
  return v === 0;
}

// ─── Kiosks tab ───────────────────────────────────────────────────────────
function KioskTab({ selection }: { selection: Selection }) {
  const utils = trpc.useUtils();
  const pushAsset = trpc.content.pushAsset.useMutation();
  const emergency = trpc.content.emergencyMessage.useMutation();
  const clearOverlays = trpc.content.clearOverlays.useMutation();
  const screenCommand = trpc.content.screenCommand.useMutation();
  const assignPlaylist = trpc.content.assignPlaylist.useMutation();
  const { data: assets } = trpc.content.listAssets.useQuery();
  const { data: screens } = trpc.content.storeScreens.useQuery(
    { storeId: selection.storeId! },
    { enabled: !!selection.storeId }
  );
  const [assetId, setAssetId] = useState("");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Monitor size={15} /> Scope-wide kiosk actions — {selection.label}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Select label="Asset burst" value={assetId} onChange={(e: any) => setAssetId(e.target.value)} options={[{ value: "", label: "— pick asset —" }, ...(assets ?? []).map((a: any) => ({ value: a.id, label: a.name }))]} />
          <Button variant="primary" disabled={!assetId} onClick={() => pushAsset.mutate({ scope: selection.scope as any, targetId: selection.targetId, assetId, durationSeconds: 120 })}>
            Push full-screen
          </Button>
          <Button variant="danger" onClick={() => clearOverlays.mutate({ scope: selection.scope as any, targetId: selection.targetId })}>
            <Eraser size={12} /> Clear overlays & resume playlists
          </Button>
        </div>
      </Card>

      {selection.storeId ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Screens</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(screens ?? []).map((s: any) => (
              <ScreenCard
                key={s.id} screen={s} assets={assets ?? []}
                onCommand={(command: any, extra: any) => screenCommand.mutate({ screenId: s.id, command, ...extra })}
                onPush={(id: any) => pushAsset.mutate({ scope: "store", targetId: s.id.split("-")[0], assetId: id, durationSeconds: 60 })}
                onAssign={(playlistId: any) => assignPlaylist.mutate({ playlistId, scope: "store", targetId: s.id.split("-")[0], screenIds: [s.id] })}
              />
            ))}
            {(screens ?? []).length === 0 && <p className="text-xs text-on-dark-secondary">No screens registered for this store yet.</p>}
          </div>
        </Card>
      ) : (
        <Card className="p-4"><p className="text-xs text-on-dark-secondary">Pick a store for per-screen controls. Scope actions above already hit every kiosk under {selection.label}.</p></Card>
      )}
    </div>
  );
}

function ScreenCard({ screen, assets, onCommand, onPush, onAssign }: any) {
  const online = screen.status === "online";
  return (
    <div className="p-3 bg-dark rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={online ? "online" : "offline"} />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{screen.id}</p>
            <p className="text-[10px] text-on-dark-secondary">{screen.hardwareType ?? screen.screenType}</p>
          </div>
        </div>
        <select
          className="cc-input !py-1 text-[11px] max-w-[130px]"
          defaultValue=""
          onChange={(e) => e.target.value && onAssign(e.target.value)}
          title="Assign playlist to this screen"
        >
          <option value="">assign…</option>
          {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="ghost" onClick={() => onCommand("reload", {})}><RotateCw size={11} /> reload</Button>
        <Button variant="ghost" onClick={() => onCommand("set_brightness", { brightness: 80 })}><SunIcon /> dim 80%</Button>
        <Button variant="ghost" onClick={() => onCommand("reboot", {})}><Power size={11} /> reboot</Button>
      </div>
    </div>
  );
}

function SunIcon() {
  return <span aria-hidden>☀</span>;
}

// ─── Scenes tab ───────────────────────────────────────────────────────────
function ScenesTab({ selection }: { selection: Selection }) {
  const { data: scenes } = trpc.scenes.list.useQuery();
  const applyScene = trpc.scenes.trigger.useMutation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {(scenes ?? []).map((scene: any) => (
        <Card key={scene.id} className="p-4">
          <h3 className="text-sm font-semibold">{scene.name}</h3>
          <p className="text-[11px] text-on-dark-secondary mt-1 line-clamp-2">{scene.description ?? "Multi-component scene"}</p>
          <div className="flex gap-1 mt-3">
            {scene.presetId && <Badge variant="new">RGB</Badge>}
            {scene.contentPlaylistId && <Badge variant="new">Content</Badge>}
            {scene.audioPlaylistId && <Badge variant="new">Audio</Badge>}
          </div>
          <Button variant="primary" className="mt-4 w-full" onClick={() => applyScene.mutate({ sceneId: scene.id, scope: selection.scope as any, targetId: selection.targetId })}>
            Apply to {selection.label}
          </Button>
          {applyScene.data && applyScene.isSuccess && (
            <p className="text-[10px] text-success mt-2">Applied → {applyScene.data.targets} store(s)</p>
          )}
        </Card>
      ))}
      {(scenes ?? []).length === 0 && (
        <Card className="p-4"><p className="text-xs text-on-dark-secondary">No scenes saved yet — bundle RGB + content + audio presets into one-click TakeOvers.</p></Card>
      )}
    </div>
  );
}

// ─── Emergency modal ──────────────────────────────────────────────────────
function EmergencyModal({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [withBlackout, setWithBlackout] = useState(true);
  const [withAnnouncement, setWithAnnouncement] = useState(true);

  const emergencyMsg = trpc.content.emergencyMessage.useMutation();
  const blackout = trpc.rgb.blackout.useMutation();
  const announce = trpc.audio.announce.useMutation();
  const busy = emergencyMsg.isPending || blackout.isPending || announce.isPending;

  const fire = () => {
    const scope = selection.scope as any;
    const targetId = selection.targetId;
    emergencyMsg.mutate({ scope, targetId, heading, body });
    if (withBlackout) blackout.mutate({ scope, targetId });
    if (withAnnouncement) {
      announce.mutate({ scope, targetId, zones: ["dining", "pickup"], text: heading, duckMusic: true, priority: 9 });
    }
    setTimeout(() => {
      utils.hierarchy.tree.invalidate();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-panel border border-error/40 rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-error flex items-center gap-2"><AlertTriangle size={18} /> Emergency Broadcast</h3>
        <p className="text-xs text-on-dark-secondary mt-1">
          Targets <b className="text-gold">{selection.label}</b>: every kiosk shows the message{withBlackout && ", lights cut"},{withAnnouncement && " PA announces the heading"}.
        </p>
        <div className="mt-4 space-y-3">
          <Input label="Headline (also spoken over PA)" value={heading} onChange={(e: any) => setHeading(e.target.value)} maxLength={120} />
          <TextArea label="Detail shown on screens (optional)" rows={2} value={body} onChange={(e: any) => setBody(e.target.value)} maxLength={500} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withBlackout} onChange={(e) => setWithBlackout(e.target.checked)} className="accent-gold" /> Cut lighting (blackout)</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withAnnouncement} onChange={(e) => setWithAnnouncement(e.target.checked)} className="accent-gold" /> PA announcement</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!heading || busy} onClick={fire}><AlertTriangle size={13} /> Broadcast now</Button>
        </div>
      </div>
    </div>
  );
}
