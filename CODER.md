# CODER.md — INFX Chroma Command Platform
## Developer Build Specification | v1.0 | 2026-05-02

> **For:** Developers building the Chroma Command control platform  
> **From:** Ricardo Maio / INFX Media  
> **Repo:** https://github.com/targetpraks/chromacommand-platform  
> **Coda Hub:** https://coda.io/d/INFX-Media-Papa-Pasta-Media_d2DRuePE-Zb/INFX-Media-Colour-Matrix-HUB_su9Xd__Q

---

## 0. The Vision

Build a single unified global control room — the **INFX Chroma Command Platform** — where one operator can manage every RGB channel, every Spotify playlist, every digital menu screen, and every LED sequence across every Papa Pasta store on Earth.

**Control flows:** `Country → Province → Region → Store → Zone → Section`

One button activates a TakeOver and the entire store transforms — walls pulse sponsor yellow, screens show sponsor content, speakers play sponsor soundscape. Under 4 seconds. Every sense. Every store.

---

## 1. RGB Lighting Control System

### 1.1 Scope Hierarchy

Any RGB command can target any level in the hierarchy:

| Scope | Example | Targets |
|-------|---------|---------|
| **Country** | `"South Africa — MTN Yellow"` | All provinces, regions, stores |
| **Province** | `"Western Cape — Springbok Green"` | All regions in that province |
| **Region** | `"Cape Town Metro — Late Night Dim"` | All stores in that region |
| **Store** | `"PP-A01 Gardens — FNB Gold Lounge"` | All zones in that store |
| **Zone** | `"PP-A01 — Booth 3 Cove — Pulse Gold"` | One specific LED strip |
| **Section** | `"PP-A01 — Dining Area — Warm Ambient"` | All zones in that restaurant section |

### 1.2 LED Zone Groups (Per Store)

| Group | Example Zones | Purpose |
|-------|---------------|---------|
| `ambient` | Ceiling Cove, Window Frame, Undercounter | General store mood |
| `decorative` | Wall Wash, Pillar Wrap, Archway, Shelf Backlight | Brand depth + texture |
| `furniture` | Table Edge, Booth Coves, Bar Front | Intimate / focused lighting |
| `floor` | Floor Perimeter, Floor Inlay, Step Tread | Path + safety + pattern |
| `service` | Counter Front, Pickup Indicator, Kitchen Pass | Service flow + status |
| `exterior` | Signage Fascia, Awning Trim, Entry Soffit | Street presence |

### 1.3 Section-Level Mapping (Critical Requirement)

A restaurant has many sections. RGBs are split **according to those sections in a very defined way**.

| Section | Zones Included |
|---------|---------------|
| **Dining Area** | Ceiling Cove (ambient), Wall Wash (decorative), Table Edge (furniture), Floor Perimeter (floor) |
| **Pickup Counter** | Undercounter (ambient), Pickup Indicator (service), Counter Front (service) |
| **Kitchen Pass** | Kitchen Pass LED (service), Counter Front partial (service) |
| **Bar Area** | Bar Front (furniture), Shelf Backlight (decorative), Ceiling Cove partial (ambient) |
| **Entrance / Foyer** | Entry Soffit (exterior), Archway (decorative), Floor Inlay (floor) |
| **Exterior Façade** | Signage Fascia (exterior), Awning Trim (exterior), Window Frame (ambient) |
| **Booths / Nooks** | Booth Coves (furniture), Table Edge (furniture), Wall Wash partial (decorative) |
| **Queue / Waiting** | Floor Perimeter (floor), Pillar Wrap (decorative) |

When a Section is commanded, the Edge Gateway decomposes it to all constituent zones:
```
Command: "Dining Area — Warm Ambient"
  → Ceiling Cove → Warm White @ 60% (solid)
  → Wall Wash → Warm White @ 50% (solid)
  → Table Edge → Gold Accent @ 40% (pulse)
  → Floor Perimeter → Warm White @ 30% (solid)
```

### 1.4 Colour Modes

| Mode | Description |
|------|-------------|
| `solid` | Static colour |
| `gradient` | Two-colour blend along strip |
| `pulse` | Breathing fade in/out |
| `chase` | Light moving along strip |
| `breath` | Slow inhale/exhale |
| `sparkle` | Random twinkle |
| `wave` | Sine-wave propagation |
| `rainbow` | Full spectrum cycle |

### 1.5 Scene System

A Scene maps a preset to zone groups simultaneously.

**Scene "MTN TakeOver":**
| Group | Colour | Mode |
|-------|--------|------|
| Exterior | #FFD100 Yellow | solid @ 100% |
| Ambient | #FFD100 → #C8A951 | fade @ 80% |
| Furniture | #C8A951 Gold | pulse @ 60% |
| Service | #00FF00 Green | solid @ 100% (ready indicator) |

### 1.6 RGB Set API
```json
POST /api/v1/rgb/set
{
  "scope": "store",
  "targetId": "pp-a01",
  "section": "dining_area",
  "colour": {
    "mode": "solid",
    "primary": "#FFF8E7",
    "brightness": 0.60,
    "speed": 1.0
  },
  "schedule": {
    "startAt": "2026-05-01T06:00:00Z",
    "endAt": "2026-05-01T23:00:00Z",
    "fadeDurationMs": 2000
  }
}
```

### 1.7 Zero-Downtime Zone Expansion

Add a new LED strip to any store without code changes, restarts, or firmware updates:
```
1. Technician connects strip to ESP32-S3
2. PUT /api/v1/stores/{store_id}/zones with metadata
3. Cloud stores in led_zones table
4. Gateway receives via MQTT, caches locally
5. Dashboard immediately shows new zone
```

---

## 2. Audio & Spotify Control System

### 2.1 Per-Zone Audio

| Zone | Speakers | Volume Range | Purpose |
|------|----------|--------------|---------|
| `dining` | 2× ceiling | 20% – 60% | Background ambience |
| `pickup` | 1× counter | 30% – 80% | Customer pickup energy |
| `exterior` | 1× awning | 10% – 40% | Street presence |
| `back-of-house` | 1× kitchen | 0% – 30% | Staff alerts only |

### 2.2 Spotify Playlist Integration

- Each **store** can have its own Spotify playlist
- Each **region** can have its own Spotify playlist
- HQ can **override globally** with one command
- Playlists are pre-cached locally; switch latency < 1s

### 2.3 Music Presets

| Preset | Genre | Energy | Colour Match | Sponsor |
|--------|-------|--------|--------------|---------|
| `papa_navy_gold` | Jazz-Hop, Lo-Fi | Calm | Navy → Gold | — |
| `morning_rush` | Upbeat House | High | Gold accent | — |
| `mtn_yellow` | Afrobeats, Electronic | High | MTN Yellow | MTN |
| `fnb_gold` | Lounge, Sophisticated | Calm-medium | Gold/Bronze | FNB |
| `springbok_green` | SA Rock, Vuvuzela | Explosive | Green → Gold | Springboks |
| `late_night` | Deep House, Chill | Low | Navy glow | — |

### 2.4 Audio Set API
```json
POST /api/v1/audio/set
{
  "scope": "store",
  "targetId": "pp-a01",
  "zone": "dining",
  "playlistId": "pl_mtn_afrobeats",
  "action": "play",
  "volume": 0.45,
  "fadeMs": 2000,
  "eq": { "bass": 2, "mid": 0, "treble": 1 },
  "ducking": { "enabled": true, "duckTo": 0.15, "restoreAfterMs": 5000 }
}
```

### 2.5 TTS Announcements
```json
POST /api/v1/audio/announce
{
  "scope": "store",
  "targetId": "pp-a01",
  "zones": ["dining", "pickup"],
  "text": "Order number 247 ready for collection.",
  "voice": "en-ZA-female-1",
  "volume": 0.70,
  "duckMusic": true
}
```
Music ducks to 15%, announcement plays, music restores over 5s.

---

## 3. Digital Menu & TV Streaming

### 3.1 Screen Types (Per Store)

| Screen ID | Type | Size | Position |
|-----------|------|------|----------|
| `menu-primary` | E-Ink / LCD | 12"–32" | Counter / wall |
| `menu-combo` | E-Ink / LCD | 12"–32" | Counter / wall |
| `promo-board` | LCD | 32"–55" | Window / pickup |
| `tv-exterior` | Commercial LCD | 43"–65" | Exterior façade |

### 3.2 TV Count & Auto-Discovery

- Dashboard shows: `"PP-A01 — 4 screens online / 4 total"`
- New screen powers on → UDP multicast `chromacommand.discover` → gateway → cloud → auto-registered
- No manual configuration required

### 3.3 Flash & Push Programming

- **Playlist engine**: sequence assets with display_time, duration, transition
- **Transitions**: fade, slide-left, slide-right, wipe, zoom
- **Priority**: sponsor content (priority 200) overrides standard menu (priority 100)
- **Scheduling**: valid_from / valid_until, days_of_week, time_ranges
- **Emergency override**: instant push bypasses all scheduling

### 3.4 Offline Content Cache
- 128GB NVMe local storage
- Renders from cache in < 2s on boot
- 7-day TTL; after 7 days offline shows `"Sync Required"`
- Emergency content pushable via local MQTT without cloud

### 3.5 Version Upload & Push Pipeline
```
Upload → Validate → Compress → CDN → MQTT notify → Diff sync → Only changed assets downloaded
```

---

## 4. TakeOver Management

### 4.1 Dedicated TakeOver Section

When there is a full TakeOver, load it into a **dedicated TakeOver Panel** in the dashboard. The system automatically applies the right colours to the right sections within the restaurant.

### 4.2 One-Button Sync

```json
POST /api/v1/sync/transform
{
  "scope": "store",
  "targetId": "pp-a01",
  "presetId": "mtn_takeover_q2_2026",
  "effectiveAt": "2026-05-01T06:00:00Z",
  "fadeDurationMs": 3000,
  "components": { "rgb": true, "content": true, "audio": true }
}
```

**What happens:**
1. Cloud dispatches 3 MQTT commands with SAME timestamp + 3s fade
2. Edge Gateway receives all 3 within 200ms
3. Executes simultaneously: RGB fade + Content crossfade + Audio crossfade
4. All 3 complete within 3.5 seconds
5. Dashboard shows: ✅ RGB | ✅ Content | ✅ Audio

### 4.3 TakeOver Types

| Type | Example | Duration |
|------|---------|----------|
| Sponsor | MTN, FNB, Vodacom | 1 week – 3 months |
| Seasonal | Spring, Summer, Holiday | 2–4 weeks |
| Event | Rugby World Cup, Festival | 1–7 days |
| Native | Papa Pasta Navy & Gold | Permanent |

### 4.4 Auto-Billing

Every TakeOver activation:
1. Opens a `sponsor_activations` row automatically
2. Tracks duration, affected stores, impressions
3. `trpc.sponsor.invoice` joins telemetry impressions × ratePerImpressionCents

### 4.5 Rollback

Every sync transform recorded in `sync_transactions`:
- `presetIdBefore`, `presetIdAfter`, `startedAt`, `completedAt`
- Operator can Rollback from dashboard — re-applies previous preset

---

## 5. Offline Resilience & Health Checks

### 5.1 Edge Gateway Local Cache

| Cache | Storage | TTL |
|-------|---------|-----|
| RGB config | SQLite | Permanent |
| Content assets | Filesystem (128GB) | 7 days |
| Audio playlists | SQLite + filesystem | 10 playlists (~500MB) |
| Screen registry | SQLite | Permanent |
| LED zone map | SQLite | Permanent |
| Command history | SQLite ring buffer | 1000 commands |

### 5.2 LED Programming & Sequencing

- **Fade transitions**: configurable (default 2000ms, TakeOver 3000ms)
- **Stagger**: large stores stagger zone updates by 50ms for ripple effect
- **Priority**: emergency commands bypass all scheduling
- **ESP32-S3**: FastLED engine, ESP-NOW mesh (<10ms), NVRAM persistence

### 5.3 Health Checks

| Check | Interval | Alert |
|-------|----------|-------|
| Gateway heartbeat | 30s | > 60s missing = offline |
| Screen count | Real-time | Expected vs actual |
| LED zone online | Real-time | Missing > 5min |
| Temperature | 5min batch | > 5°C sustained 10min = R638 critical |
| Footfall drop | 5min batch | > 50% vs yesterday |

### 5.4 OTA Firmware Updates

| Device | Update Path | Rollback |
|--------|-------------|----------|
| ESP32-S3 | MQTT `firmware/install` → ESP-NOW | Backup partition |
| Pi 5 Screen | Docker image pull | Tagged image |
| Pi 5 Audio | `apt` + MPD config | Config backup |
| Edge Gateway | Docker image pull | Tagged compose |

---

## 6. Auth, RBAC & Integration Layer

### 6.1 JWT + Refresh Token Rotation

- 1h access / 30d refresh
- Single-use rotation: present old refresh → new pair issued → old marked revoked
- **Reuse detection**: presenting revoked refresh = theft → nuke ALL sessions for that user

### 6.2 Scope-Based RBAC

| Role | Scope | Permissions |
|------|-------|-------------|
| HQ Admin | `*` | Everything |
| Regional Manager | `region:cape-town` | Region only |
| Franchisee | `store:pp-a01` | Own store only |
| Sponsor Viewer | `sponsor campaign` | Their campaign only |
| Technician | `*` | Hardware debug |

### 6.3 MQTT Topic Hierarchy

```
chromacommand/store/{id}/rgb/set/{zone}
chromacommand/store/{id}/rgb/state/{zone}
chromacommand/store/{id}/content/playlist
chromacommand/store/{id}/audio/set/{zone}
chromacommand/store/{id}/audio/state/{zone}
chromacommand/store/{id}/telemetry/sensors
chromacommand/store/{id}/screens/discover
chromacommand/store/{id}/firmware/install
```

### 6.4 WebSocket Live Updates

- Dashboard opens persistent WS to `/live/ws`
- Subscribes to topics, invalidates React Query cache on events
- **Zero polling** — instant updates, zero idle traffic
- Auth via `?token=` query parameter

---

## 7. Dashboard Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Matrix View** | `/` | Grid of all stores with live colour swatches, status, counts |
| **Store Detail** | `/stores/[id]` | RGB tab, Screens tab, Audio tab, Analytics tab |
| **Sync** | `/sync` | One-Button Sync with preset + scope selector |
| **Content Manager** | `/content` | Asset uploader, playlist builder, schedule calendar |
| **Audio Control** | `/audio` | Per-zone volume, playlist, TTS, EQ |
| **Analytics** | `/analytics` | Stats, footfall, content performance, activity log |
| **Sponsor Dashboard** | `/sponsor` | Read-only: impressions, footfall, QR scans, time-series |
| **Schedules** | `/schedules` | Cron preset management, priority editor |
| **Alerts** | `/alerts` | Severity summary, rule creation, event feed |
| **Settings** | `/settings` | Profile, org, roles, logout |

---

## 8. Tech Stack

| Layer | Technology |
|-------|-----------|
| Dashboard | Next.js 14 + Tailwind + Framer Motion |
| API | Fastify + tRPC + Zod |
| Database | PostgreSQL 16 + Drizzle ORM (23 tables) |
| Cache | Redis 7 |
| Messaging | MQTT (Mosquitto/EMQX) + WebSocket |
| Edge | Node.js + SQLite |
| LED Firmware | ESP32-S3 + FastLED + ESP-NOW |
| Screen Player | Raspberry Pi 5 + Electron kiosk |
| Audio Player | Pi 5 + HiFiBerry DAC2 Pro + MPD |
| Auth | JWT + refresh rotation + RBAC |
| Metrics | Prometheus + Grafana |

---

## 9. File Structure

```
chromacommand-platform/
├── apps/
│   ├── api/              # Fastify + tRPC backend
│   ├── dashboard/        # Next.js 14 control console
│   └── edge-gateway/     # Per-store Node service
├── packages/
│   ├── database/         # Drizzle ORM + migrations + seed
│   └── shared/           # Cross-package types + tRPC router-stub
├── firmware/
│   ├── led-controller/   # ESP32-S3 FastLED
│   ├── screen-player/    # Pi 5 Electron kiosk
│   └── audio-player/     # Pi 5 MPD control
├── docker/               # Dockerfiles
└── .github/workflows/    # CI: typecheck, build, e2e, vitest
```

---

## 10. Current Status

**Phase 6.5 COMPLETE** — 59+ files, 23 DB tables, 12 tRPC routers, WebSocket live updates, sponsor dashboard, auto-seed, Docker Compose, E2E tests, auth/RBAC, real MQTT dispatch, sensor telemetry, Prometheus metrics, refresh-token rotation, scheduled transitions, screen auto-discovery, sponsor billing, edge gateway Docker + provisioning, OTA firmware, R638 alerts, materialized views, nightly maintenance.

**Next:** Phase 7+ — Multi-country expansion, advanced analytics, mobile companion, AI playlist curation.

---

*This document is the canonical developer build spec for the INFX Chroma Command Platform. For the full product requirements, see `PRD.md`. For implementation progress, see `PROGRESS.md`.*
