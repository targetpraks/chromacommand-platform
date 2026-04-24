import { db } from "./index";
import * as schema from "./schema";

async function seed() {
  console.log("🌱 Seeding Papa Pasta demo data...");

  // ── Org ──
  const [org] = await db.insert(schema.orgs).values({
    name: "Papa Pasta Franchising (Pty) Ltd",
    type: "franchise",
  }).returning();

  // ── Stores ──
  const stores = await db.insert(schema.stores).values([
    { id: "pp-a01", name: "PP-A01 Cape Town CBD", regionId: "cape-town", address: "Shop 4, Wale Street, Cape Town CBD, 8001", status: "active", orgId: org.id },
    { id: "pp-a02", name: "PP-A02 Gardens", regionId: "cape-town", address: "7 Kloof Street, Gardens, Cape Town, 8001", status: "active", orgId: org.id },
    { id: "pp-a03", name: "PP-A03 Sea Point", regionId: "cape-town", address: "112 Main Road, Sea Point, Cape Town, 8005", status: "active", orgId: org.id },
    { id: "pp-j01", name: "PP-J01 Sandton", regionId: "johannesburg", address: "Level 2, Sandton City, Sandton, 2196", status: "offline", orgId: org.id },
    { id: "pp-j02", name: "PP-J02 Rosebank", regionId: "johannesburg", address: "The Zone, Rosebank, Johannesburg, 2196", status: "active", orgId: org.id },
    { id: "pp-d01", name: "PP-D01 Umhlanga", regionId: "durban", address: "Gateway Mall, Umhlanga, Durban, 4319", status: "active", orgId: org.id },
  ]).returning();

  // ── LED Zones (8 per store) ──
  const zonesData: any[] = [];
  const zoneTemplates = [
    { id: "ceiling", displayName: "Ceiling Cove", group: "ambient", ledCount: 350 },
    { id: "window", displayName: "Window Frame", group: "ambient", ledCount: 175 },
    { id: "undercounter", displayName: "Undercounter Glow", group: "ambient", ledCount: 95 },
    { id: "wall-wash", displayName: "Back Wall Wash", group: "decorative", ledCount: 250 },
    { id: "counter-front", displayName: "Counter Front", group: "service", ledCount: 120 },
    { id: "pickup", displayName: "Pickup Indicator", group: "service", ledCount: 85 },
    { id: "table-1", displayName: "Table 1 Edge", group: "furniture", ledCount: 50 },
    { id: "signage", displayName: "Signage Fascia", group: "exterior", ledCount: 220 },
  ];

  for (const store of stores) {
    for (const zt of zoneTemplates) {
      zonesData.push({
        id: `${store.id}-${zt.id}`,
        storeId: store.id,
        displayName: zt.displayName,
        group: zt.group,
        controllerMac: `A4:CF:12:00:${Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase()}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase()}`,
        ledCount: zt.ledCount,
        currentColour: zt.id === "undercounter" || zt.id === "table-1" ? "#C8A951" : (zt.id === "pickup" ? "#00D26A" : (zt.id === "counter-front" ? "#FFFFFF" : "#1B2A4A")),
        currentMode: zt.id === "wall-wash" ? "breath" : (zt.id === "signage" ? "pulse" : (zt.id === "undercounter" ? "gradient" : "solid")),
        status: store.status === "offline" ? "offline" : "online",
      });
    }
  }

  // Split into chunks to avoid param limit
  for (let i = 0; i < zonesData.length; i += 50) {
    await db.insert(schema.ledZones).values(zonesData.slice(i, i + 50));
  }

  // ── Screens ──
  const screensData: any[] = [];
  for (const store of stores) {
    screensData.push(
      { id: `${store.id}-menu-primary`, storeId: store.id, screenType: "eink", hardwareType: "Visionect 12\"", status: store.status === "offline" ? "offline" : "online" },
      { id: `${store.id}-menu-combo`, storeId: store.id, screenType: "eink", hardwareType: "Visionect 12\"", status: store.status === "offline" ? "offline" : "online" },
      { id: `${store.id}-promo-board`, storeId: store.id, screenType: "lcd", hardwareType: "Samsung 32\`", status: store.status === "offline" ? "offline" : "online" },
    );
  }
  for (let i = 0; i < screensData.length; i += 50) {
    await db.insert(schema.screens).values(screensData.slice(i, i + 50));
  }

  // ── Audio Zones ──
  const audioData: any[] = [];
  for (const store of stores) {
    audioData.push(
      { id: `${store.id}-dining`, storeId: store.id, zoneType: "dining", sinkName: "Dining Speakers", volume: 0.45, status: store.status === "offline" ? "offline" : "online" },
      { id: `${store.id}-pickup`, storeId: store.id, zoneType: "pickup", sinkName: "Pickup Speaker", volume: 0.55, status: store.status === "offline" ? "offline" : "online" },
      { id: `${store.id}-exterior`, storeId: store.id, zoneType: "exterior", sinkName: "Exterior Speaker", volume: 0, status: "stopped" },
    );
  }
  for (let i = 0; i < audioData.length; i += 50) {
    await db.insert(schema.audioZones).values(audioData.slice(i, i + 50));
  }

  // ── RGB Presets ──
  await db.insert(schema.rgbPresets).values([
    { name: "Navy & Gold Native", description: "Default Papa Pasta brand colours", colours: { all: "#1B2A4A" }, mode: "solid", brightness: 0.85, isGlobal: true },
    { name: "MTN Yellow", description: "MTN brand takeover — bright yellow", colours: { all: "#FFD100" }, mode: "solid", brightness: 0.9, isGlobal: true },
    { name: "FNB Gold", description: "FNB brand takeover — gold pulse", colours: { all: "#CBA135" }, mode: "pulse", brightness: 0.8, isGlobal: true },
    { name: "Late Night", description: "Dimmed warm glow for after-hours", colours: { all: "#FF6B35" }, mode: "breath", brightness: 0.3, isGlobal: true },
  ]);

  // ── Content Assets ──
  await db.insert(schema.contentAssets).values([
    { name: "Standard Menu", type: "template", htmlContent: "<div class=\"menu-board\"><h1>Papa Pasta</h1><div class=\"item\"><span>Fusilli Napoletana</span><span>R89</span></div></div>", css: ".menu-board { font-family: sans-serif; color: white; }", dimensions: { width: 1080, height: 1920 }, durationSeconds: 15, priority: 100, tags: ["menu", "standard"] },
    { name: "Combo Deal — R149", type: "template", htmlContent: "<div class=\"promo\"><h2>Combo Deal</h2><p>Pasta + Drink</p><p class=\"price\">R149</p></div>", css: ".promo { text-align: center; color: #C8A951; }", dimensions: { width: 1920, height: 1080 }, durationSeconds: 10, priority: 80, tags: ["promo", "combo"] },
    { name: "MTN TakeOver — Week 2", type: "template", htmlContent: "<div class=\"takeover\"><h1>MTN TakeOver</h1><p>Week 2 of 4</p></div>", css: ".takeover { background: #FFD100; color: black; text-align: center; }", dimensions: { width: 1920, height: 1080 }, durationSeconds: 20, priority: 200, tags: ["takeover", "mtn"] },
    { name: "FNB Partner Board", type: "template", htmlContent: "<div class=\"partner\"><h1>FNB eBucks</h1><p>50% back in eBucks</p></div>", css: ".partner { background: #CBA135; color: black; }", dimensions: { width: 1920, height: 1080 }, durationSeconds: 15, priority: 150, tags: ["takeover", "fnb"] },
  ]);

  // ── Playlists ──
  const [pl1] = await db.insert(schema.playlists).values([
    { name: "Standard Menu Loop", items: [{ assetId: "standard-menu", duration: 15 }, { assetId: "combo-deal", duration: 10 }], loopDuration: 25, orgId: org.id },
  ]).returning();

  // ── Audio Playlists ──
  await db.insert(schema.audioPlaylists).values([
    { name: "Jazz Hop", tracks: [{ title: "Chillhop Essentials", url: "/audio/chillhop.mp3" }, { title: "Late Night Jazz", url: "/audio/late-jazz.mp3" }], tags: ["jazz", "chill"] },
    { name: "Afrobeats", tracks: [{ title: "Afro Fusion Mix", url: "/audio/afro.mp3" }], tags: ["afrobeats", "energetic"] },
    { name: "Ambient Dining", tracks: [{ title: "Soft Piano", url: "/audio/piano.mp3" }], tags: ["ambient", "dining"] },
  ]);

  console.log("✅ Seed complete:");
  console.log(`   ${stores.length} stores, ${zonesData.length} LED zones, ${screensData.length} screens, ${audioData.length} audio zones`);
  console.log(`   4 presets, 4 content assets, 1 playlist, 3 audio playlists`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
