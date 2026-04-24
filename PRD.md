# ChromaCommand Platform — Product Requirements Document
## v1.0 | Papa Pasta Franchise Network | 24 April 2026

---

## 1. Problem Statement

The Papa Pasta franchise network requires a single, unified command platform that controls two real-time physical systems across every store:

1. **RGB Lighting** — Every store has LED strips (ceiling, window, counter, pickup, sign) that must change colour instantly for brand TakeOvers, seasonal themes, time-of-day schedules, or sponsor activations. Currently there is no way to push colour changes to 1 store or 100 stores simultaneously.

2. **Digital Menu Screens** — Every store has 3+ digital displays (Primary Menu, Combo Board, Promo Board) that must show real-time pricing, menu updates, and sponsor advertising content. Currently there is no CMS to push content across the network, and no offline resilience when internet drops.

Without this platform, every store change (new sponsor, price update, seasonal menu) requires physical site visits, manual uploads, or store-by-store configuration. At 10 stores this is painful. At 100 stores it's impossible.

---

## 2. Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | Push RGB colour changes across the entire network in < 2 seconds | P95 latency |
| G2 | Push menu/pricing updates to any screen in any store in < 30 seconds | P99 latency |
| G3 | All stores survive internet outage with last-known config for 7+ days | Offline resilience |
| G4 | Auto-detect and register every new screen that connects to a store | Zero-touch screen onboarding |
| G5 | Single unified dashboard shows all stores, all screens, all RGB states | One pane of glass |
| G6 | Role-based access (HQ admin, regional manager, franchisee, sponsor viewer) | ACL compliance |
| G7 | Sponsor advertising loop with scheduling, rotation, and impression logging | TakeOver revenue support |

---

## 3. Non-Goals

| # | What We Will NOT Build | Why |
|---|------------------------|-----|
| NG1 | POS integration or ordering system | Out of scope — POS is separate (POSBytz) |
| NG2 | AR/WebAR content creation | Handled by INFX Media / Hololink separately |
| NG3 | Franchise recruitment CRM | papapasta.co.za handles this |
| NG4 | Loyalty program management | Separate system |
| NG5 | Native mobile apps | Web-first dashboard, PWA only |
| NG6 | Billing/invoicing for sponsors | Zoho CRM handles contracting |

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD CHROMACOMMAND HUB                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Dashboard  │  │   REST API  │  │  WebSocket  │  │  MQTT Broker    │  │
│  │  (Next.js)  │  │  (Fastify)  │  │   Server    │  │  (HiveMQ/EMQX)  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
│         │                │                │                │              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     PostgreSQL + Redis + CDN                       │  │
│  │   • Store registry, screen registry, colour states, schedules       │  │
│  │   • Real-time state cache (Redis Pub/Sub)                         │  │
│  │   • Content assets (Cloudflare R2 / AWS S3)                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ HTTPS/WSS + MQTT over TLS (port 8883)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PER-STORE EDGE GATEWAY                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │           Lenovo ThinkCentre Tiny M90q (1 per store)                 │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │  │
│  │  │  MQTT Client      │  │  Local Cache      │  │  WebSocket Client   │ │  │
│  │  │  (Python/paho)    │  │  (SQLite + FS)    │  │  (auto-reconnect)   │ │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │  │
│  │  Stores last config. Survives outage. Auto-syncs on reconnect.     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────┬─────────────────────┬─────────────────────┬─────────────────┘
               │                     │                     │
               │ MQTT/ESP-NOW        │ HDMI/DP             │ UART → MQTT
               │                     │                     │
               ▼                     ▼                     ▼
┌──────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  RGB CONTROLLER  │    │  SCREEN PLAYER       │    │   SENSOR AGGREGATOR  │
│  (per zone)      │    │  (per screen bank)   │    │   (per store)        │
│  ESP32-S3 /      │    │  Raspberry Pi 5 +    │    │   STM32L4 + ESP32    │
│  RP2040          │    │  PoE HAT             │    │                      │
│                  │    │  Electron / Flutter  │    │   • Footfall (LiDAR) │
│  PWM → WS2812B   │    │  Player App          │    │   • Temp (R638)      │
│  PWM → APA102    │    │                      │    │   • Queue time       │
│  ZONES:          │    │  Caches content.     │    │                      │
│  ceiling, window │    │  Syncs every 60s.    │    │   Push: 1Hz raw      │
│  counter, pickup │    │  Offline 7+ days.    │    │   5min aggregated    │
│  sign            │    │                      │    │   <5min to cloud     │
└──────────────────┘    └──────────────────────┘    └─────────────────────┘
```

### 4.2 Communication Protocols

| Layer | Protocol | Purpose | Port |
|-------|----------|---------|------|
| Dashboard → API | HTTPS | CRUD operations, auth | 443 |
| Dashboard → API | WebSocket | Real-time state push | 443 (WSS) |
| API → MQTT | MQTT over TLS | Command dispatch to stores | 8883 |
| Edge → Cloud | MQTT over TLS | Telemetry, heartbeats, acks | 8883 |
| Edge → RGB Node | ESP-NOW / WiFi | Low-latency colour push | 2.4GHz |
| Edge → Screen | HDMI / DisplayPort | Video signal | Physical |
| Edge → Sensor | UART / I2C | Sensor data ingestion | Physical |

### 4.3 MQTT Topic Hierarchy

```
chromacommand/
├── global/
│   ├── rgb/set              ← "set colour network-wide"
│   ├── rgb/state            → "confirmed network colour state"
│   ├── rgb/schedule         ← "push a global schedule"
│   ├── content/set          ← "push content to all stores"
│   └── content/state        → "all-store content sync status"
│
├── region/{region_id}/
│   ├── rgb/set              ← "set colour for entire region"
│   ├── rgb/state            → "confirmed region colour state"
│   ├── content/set          ← "push content to region"
│   └── content/state        → "region content sync status"
│
├── store/{store_id}/
│   ├── rgb/
│   │   ├── set/{zone}       ← "set colour for specific zone"
│   │   ├── state/{zone}     → "confirmed zone colour + brightness"
│   │   ├── schedule         ← "push store-level schedule"
│   │   └── effects/{zone}   ← "trigger animation on zone"
│   ├── content/
│   │   ├── playlist         ← "push playlist to store"
│   │   ├── state            → "which content is currently showing"
│   │   ├── screen/{screen_id}/set   ← "content for specific screen"
│   │   └── screen/{screen_id}/state → "confirmed screen content"
│   ├── telemetry/
│   │   ├── heartbeat        → "store online every 30s"
│   │   ├── sensors          → "sensor data batch (footfall, temp)"
│   │   └── errors           → "error logs from edge gateway"
│   └── screens/
│       ├── discover         → "new screen detected"
│       ├── register         ← "register/acknowledge screen"
│       └── health/{screen_id} → "screen health (online/offline)"
```

### 4.4 Network Topology — Per-Store VLAN Segmentation

```
┌─────────────────────────────────────────────────────────────┐
│                    STORE LAN (UniFi-managed)                  │
│  VLAN 10: POS (POSBytz — ISOLATED)                           │
│  VLAN 20: IoT (LED controllers, sensors, E-Ink)              │
│  VLAN 30: Signage (Screen players, digital menu boards)      │
│  VLAN 40: Management (Edge gateway, admin access)            │
│  VLAN 50: Guest (Customer WiFi — ISOLATED)                   │
│                                                              │
│  Edge Gateway (ThinkCentre Tiny) bridges VLAN 20, 30, 40    │
│  Firewall: VLAN 10 and 50 CANNOT talk to each other           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Module 1 — RGB Store Controller

### 5.1 Purpose
Push real-time colour control to every LED zone across every store. Support instant override, scheduled transitions, animation effects, and offline resilience.

### 5.2 Hardware Spec

| Component | Spec | Rejected | Rationale |
|-----------|------|----------|-----------|
| **LED Strip** | WS2812B (5V, 60 LEDs/m) or APA102 (5V, 60 LEDs/m) | Analog RGB (no per-LED) | Addressable = per-LED colour control, animations |
| **Controller Node** | ESP32-S3 (WiFi + BT) or RP2040 + ESP-01 | WLED pre-built board | Custom protocol, tight timing, cost ~R80/unit |
| **Driver** | PWM + DMA | Software bit-bang | DMA offloads timing, stable at >1000 LEDs |
| **Per Store Zones** | Ceiling, Window, Counter, Pickup, Sign | — | 5 zones = 5 controller nodes per store |
| **Connectivity** | ESP-NOW (local mesh) + WiFi fallback | BLE only | ESP-NOW: <10ms latency, no router dependency |
| **Wired Fallback** | RS-485 (500m range, noise immune) | I2C (short range) | RS-485 for long runs between zones |

### 5.3 LED Zone Configuration (Per Store)

| Zone | LED Count | Position | Purpose |
|------|-----------|----------|---------|
| Ceiling | 300-500 | Recessed cove lighting | Ambient brand colour |
| Window | 150-200 | Window frame (inside) | Street-facing brand colour |
| Counter | 100-150 | Customer-facing counter | Accent colour, warm white for service |
| Pickup | 80-100 | Pickup counter | Status indicator (ready = green, wait = gold) |
| Sign | 200-300 | Exterior fascia sign | Logo illumination, sponsor colour |

### 5.4 RGB Control API

**POST /api/v1/rgb/set**
```json
{
  "scope": "store",        // "global" | "region" | "store" | "zone"
  "target_id": "pp-a01",   // store_id or region_id or "all"
  "zone": "counter",       // optional — omit for all zones
  "colour": {
    "mode": "solid",       // "solid" | "gradient" | "pulse" | "chase" | "breath"
    "primary": "#1B2A4A",  // Navy
    "secondary": "#C8A951", // Gold (for gradient/pulse)
    "brightness": 0.85,    // 0.0 — 1.0
    "speed": 1.0           // animation speed multiplier
  },
  "schedule": {
    "start_at": "2026-04-24T18:00:00Z",
    "end_at": "2026-04-24T23:00:00Z",
    "fade_duration_ms": 2000
  }
}
```

**Response:**
```json
{
  "command_id": "cmd_abc123",
  "status": "dispatched",
  "targets": 1,
  "estimated_arrival_ms": 150,
  "mqtt_topic": "chromacommand/store/pp-a01/rgb/set/counter"
}
```

### 5.5 Colour Presets & Scheduling

**Presets Table (PostgreSQL):**
```sql
CREATE TABLE rgb_presets (
  id UUID PRIMARY KEY,
  name VARCHAR(64) NOT NULL,        -- "Navy Gold Native"
  description TEXT,
  colours JSONB NOT NULL,           -- { "ceiling": "#1B2A4A", ... }
  mode VARCHAR(32) DEFAULT 'solid', -- solid | gradient | pulse | chase | breath
  brightness FLOAT DEFAULT 1.0,
  speed FLOAT DEFAULT 1.0,
  created_by UUID REFERENCES users(id),
  org_id UUID REFERENCES orgs(id),
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Schedule Table:**
```sql
CREATE TABLE rgb_schedules (
  id UUID PRIMARY KEY,
  name VARCHAR(64) NOT NULL,        -- "Morning Open"
  preset_id UUID REFERENCES rgb_presets(id),
  scope VARCHAR(16) NOT NULL,       -- global | region | store
  target_id VARCHAR(32) NOT NULL,   -- store_id or region_id or "all"
  cron_expression VARCHAR(64) NOT NULL, -- "0 6 * * 1-5" = 6AM weekdays
  timezone VARCHAR(64) DEFAULT 'Africa/Johannesburg',
  active BOOLEAN DEFAULT true,
  priority INT DEFAULT 100,          -- Higher = overrides lower priority
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.6 Offline Behaviour

1. Edge gateway stores last RGB config in local SQLite
2. On boot, gateway reads SQLite → pushes to all connected LED nodes
3. If internet drops, gateway continues executing local schedules
4. When internet returns: gateway publishes `"chromacommand/store/{id}/rgb/state"` with full current state → cloud reconciles
5. Cloud pushes any missed commands within the outage window

---

## 6. Module 2 — Digital Menu & Advertising Stream Controller

### 6.1 Purpose
Push content (menu boards, pricing, promo slides, sponsor advertising) to every digital screen across the network. Support instant updates, scheduled playlists, offline caching, and impression logging.

### 6.2 Hardware Spec

| Component | Spec | Rejected | Rationale |
|-----------|------|----------|-----------|
| **Player Device** | Raspberry Pi 5 + PoE HAT | Android TV, Intel NUC | Full Linux, programmable, low cost (~R2,500) |
| **Display** | Visionect E-Ink 12" (menu boards) | LCD, LED | Ultra-low power, always-on, no glare, 5yr+ lifespan |
| **Display** | 32"-55" Commercial LCD | Consumer TV | 18/7 duty cycle, VESA mount, RS-232 control |
| **Player OS** | Raspberry Pi OS Lite (Bookworm) | Ubuntu Desktop | Minimal footprint, boots in <15s |
| **Player App** | Electron (with kiosk mode) | Flutter, Chromium | Node.js ecosystem, rapid iteration, offline capable |
| **Storage** | 128GB NVMe (via USB3) | SD card only | NVMe for asset cache reliability and speed |

### 6.3 Screen Types (Per Store)

| Screen ID | Type | Size | Position | Content |
|-----------|------|------|----------|---------|
| `menu-primary` | E-Ink | 12" | Counter / wall | Primary menu — core items + prices |
| `menu-combo` | E-Ink | 12" | Counter / wall | Combo boards — meal deals |
| `promo-board` | LCD | 32" | Window / pickup | Promo loop — sponsor ads, seasonal content |

### 6.4 Content Model

**Content Asset:**
```json
{
  "asset_id": "asset_xyz789",
  "name": "MTN TakeOver Promo — Week 1",
  "type": "html",        // "html" | "image" | "video" | "template"
  "html_content": "<div class='promo-slide'>...</div>",
  "css": "body { background: #FFD100; color: #000; }",
  "dimensions": { "width": 1920, "height": 1080 },
  "duration_seconds": 15,
  "priority": 100,       // Higher = shown first / overrides lower
  "valid_from": "2026-05-01T00:00:00Z",
  "valid_until": "2026-05-31T23:59:59Z",
  "tags": ["sponsor-mtn", "q2-2026", "national"],
  "created_by": "user_abc",
  "org_id": "org_infx"
}
```

**Playlist:**
```json
{
  "playlist_id": "pl_123",
  "name": "PP-A01 — Standard Menu",
  "screens": ["menu-primary", "menu-combo"],
  "items": [
    {
      "asset_id": "asset_menu_v1",
      "display_time": 0,      // seconds from start of loop
      "duration": 30,
      "transition": "fade"
    },
    {
      "asset_id": "asset_mtn_promo",
      "display_time": 30,
      "duration": 15,
      "transition": "slide-left"
    }
  ],
  "loop_duration": 45,
  "schedule": {
    "valid_from": "2026-04-24",
    "valid_until": null,
    "days_of_week": [1,2,3,4,5,6,7],
    "time_ranges": [{"start": "06:00", "end": "22:00"}]
  }
}
```

### 6.5 Content Management API

**POST /api/v1/content/assets**
```json
{
  "name": "New Menu Board",
  "type": "template",
  "template_id": "tmpl_menu_primary",
  "variables": {
    "prices": {
      "fusilli_napoletana": 89,
      "penne_arrabbiata": 79,
      "spaghetti_carbonara": 95
    },
    "currency": "ZAR",
    "show_combo": true
  },
  "dimensions": { "width": 1200, "height": 1600 }
}
```

**POST /api/v1/content/playlists/assign**
```json
{
  "playlist_id": "pl_123",
  "scope": "store",
  "target_id": "pp-a01",
  "screens": ["menu-primary", "menu-combo"],
  "effective_immediately": true
}
```

### 6.6 Diff Sync Protocol

Instead of pushing full playlists every 60s, the sync engine uses a diff-based approach:

1. Player sends current `content_manifest` hash on every sync
2. Server computes diff: which assets changed / added / deleted
3. Server sends only changed assets (not full playlist)
4. Player applies diff, updates local cache, confirms with new hash
5. If player's hash is unknown (corrupted cache), server sends full manifest

**Diff Message (MQTT):**
```json
{
  "type": "diff",
  "store_id": "pp-a01",
  "screen_id": "menu-primary",
  "base_hash": "a1b2c3",
  "target_hash": "d4e5f6",
  "add": [{"asset_id": "new_asset", "url": "..."}],
  "update": [{"asset_id": "changed_price", "url": "..."}],
  "delete": ["old_asset_id"],
  "timestamp": "2026-04-24T18:00:00Z"
}
```

### 6.7 Screen Auto-Detection & Registration

**Discovery Flow:**

1. New screen/player powers on, connects to store LAN (VLAN 30)
2. Screen broadcasts UDP multicast: `"chromacommand.discover"` on port 5353
3. Edge gateway receives discovery, checks if screen is already registered
4. If new: gateway forwards discovery to cloud via MQTT
5. Cloud generates `screen_id`, assigns to store, writes to DB
6. Cloud sends registration ack back through gateway → screen
7. Screen now appears in dashboard with default content

**Screen Registration Payload:**
```json
{
  "mac_address": "b8:27:eb:xx:xx:xx",
  "hardware_type": "raspberry_pi_5",
  "ip_address": "192.168.30.45",
  "screen_model": "visionect_eink_12",
  "dimensions": { "width": 1200, "height": 1600 },
  "firmware_version": "1.2.3",
  "store_id": "pp-a01"    // determined by gateway based on VLAN/subnet
}
```

### 6.8 Offline Behaviour

1. Player caches ALL content assets locally (128GB NVMe)
2. On boot: player renders from local cache immediately (< 2s)
3. Background sync every 60s while online
4. If offline: player continues looping cached content
5. When connection returns: player requests diff sync, applies updates
6. Content TTL: 7 days — after 7 days offline, player shows "Sync Required" notice
7. Emergency override: gateway can push local emergency content (e.g., price freeze) via local MQTT without cloud

---

## 7. Module 3 — Colour Matrix Hub (Control Room Dashboard)

### 7.1 Purpose
Single unified web dashboard that gives the operator command-center visibility and control over every store, every screen, and every LED zone.

### 7.2 Dashboard Views

#### 7.2.1 Network Overview (Matrix View)

- **Grid layout**: Each store is a card in a responsive grid
- **Store card shows**:
  - Store code + name + region
  - Online/offline status (green dot / red dot)
  - Current RGB state (colour swatch per active zone)
  - Active content (playlist name + sponsor tag)
  - Screen count + live screen count
  - Last heartbeat timestamp
- **Filters**: Region, status (online/offline), active sponsor
- **Bulk actions**: "Set all selected stores to Navy Gold", "Push emergency content"

#### 7.2.2 Store Detail View

- **Store info**: Location, manager, contact, hardware status
- **RGB tab**: Per-zone colour picker, preset selector, schedule viewer
- **Screens tab**: Per-screen content preview, playlist control, screen health
- **Sensors tab**: Real-time footfall graph, temperature log, queue time
- **History tab**: Change log (who changed what, when)

#### 7.2.3 Content Manager

- **Asset library**: Upload, preview, tag, search content assets
- **Playlist builder**: Drag-and-drop asset sequence, timing, transitions
- **Schedule calendar**: Visual calendar showing what plays where and when
- **Sponsor slots**: Assign sponsor content to specific stores + date ranges

#### 7.2.4 Analytics

- **Impressions**: Receipt prints × 1.2 + digital menu views × 0.8 + E-Ink views × 0.3
- **Footfall**: Hourly/daily pedestrian count per store
- **QR scans**: Daily scan count per campaign
- **AR engagement**: Average dwell time per AR experience
- **Content performance**: Which promo slides got most screen time

### 7.3 Role-Based Access Control

| Role | RGB Control | Content | Analytics | Admin |
|------|-------------|---------|-----------|-------|
| **HQ Admin** | All stores | All stores | All | Users, orgs, stores |
| **Regional Manager** | Region only | Region only | Region only | — |
| **Franchisee** | Own store only | Own store only | Own store only | — |
| **Sponsor Viewer** | View only (their TakeOver) | View only (their content) | Their campaign only | — |
| **Technician** | All stores (debug) | All stores (debug) | All (debug) | Hardware only |

**ACL Implementation:**
- JWT tokens with `scope` claim: `["store:pp-a01", "region:cape-town", "org:infx"]`
- Every API endpoint checks `scope` against `target_id` in request
- Row-level security in PostgreSQL: `WHERE store_id = ANY(current_user_stores())`

---

## 8. Data Model

### 8.1 Core Entities

```sql
-- Organisations
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('franchisor', 'sponsor', 'agency')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores
CREATE TABLE stores (
  id VARCHAR(32) PRIMARY KEY,           -- e.g. "pp-a01"
  name VARCHAR(128) NOT NULL,
  region_id VARCHAR(32) NOT NULL,
  address TEXT,
  lat FLOAT,
  lon FLOAT,
  manager_id UUID REFERENCES users(id),
  org_id UUID REFERENCES orgs(id),
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'setup')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(256) NOT NULL UNIQUE,
  name VARCHAR(128),
  role VARCHAR(32) NOT NULL CHECK (role IN ('hq_admin', 'regional_manager', 'franchisee', 'sponsor_viewer', 'technician')),
  org_id UUID REFERENCES orgs(id),
  scope JSONB DEFAULT '[]',              -- ["store:pp-a01", "region:cape-town"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Screens
CREATE TABLE screens (
  id VARCHAR(32) PRIMARY KEY,            -- e.g. "pp-a01-menu-primary"
  store_id VARCHAR(32) REFERENCES stores(id),
  screen_type VARCHAR(32) NOT NULL CHECK (screen_type IN ('menu-primary', 'menu-combo', 'promo-board')),
  hardware_type VARCHAR(64),
  mac_address VARCHAR(17) UNIQUE,
  ip_address INET,
  dimensions JSONB,                     -- { "width": 1200, "height": 1600 }
  firmware_version VARCHAR(32),
  status VARCHAR(16) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'setup')),
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LED Zones
CREATE TABLE led_zones (
  id VARCHAR(32) PRIMARY KEY,            -- e.g. "pp-a01-ceiling"
  store_id VARCHAR(32) REFERENCES stores(id),
  zone_type VARCHAR(32) NOT NULL CHECK (zone_type IN ('ceiling', 'window', 'counter', 'pickup', 'sign')),
  controller_mac VARCHAR(17),
  led_count INT DEFAULT 0,
  current_colour VARCHAR(7) DEFAULT '#1B2A4A',
  current_brightness FLOAT DEFAULT 1.0,
  current_mode VARCHAR(32) DEFAULT 'solid',
  status VARCHAR(16) DEFAULT 'online',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Assets
CREATE TABLE content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('html', 'image', 'video', 'template')),
  template_id UUID REFERENCES content_templates(id),
  variables JSONB,
  html_content TEXT,
  css TEXT,
  dimensions JSONB,
  duration_seconds INT DEFAULT 15,
  priority INT DEFAULT 100,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  tags TEXT[],
  org_id UUID REFERENCES orgs(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Templates
CREATE TABLE content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  html_structure TEXT NOT NULL,
  css_base TEXT,
  variable_schema JSONB,                -- { "prices": "object", "show_combo": "boolean" }
  preview_image_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlists
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  items JSONB NOT NULL,                 -- array of { asset_id, display_time, duration, transition }
  loop_duration INT,
  schedule JSONB,                       -- { days_of_week, time_ranges, valid_from, valid_until }
  created_by UUID REFERENCES users(id),
  org_id UUID REFERENCES orgs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist Assignments
CREATE TABLE playlist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id),
  screen_id VARCHAR(32) REFERENCES screens(id),
  scope VARCHAR(16) NOT NULL,           -- "store" | "region" | "global"
  target_id VARCHAR(32) NOT NULL,
  priority INT DEFAULT 100,
  active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id)
);

-- Activity Log (Audit Trail)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(64) NOT NULL,         -- "rgb_set" | "content_push" | "playlist_assign"
  scope VARCHAR(16) NOT NULL,
  target_id VARCHAR(32) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Redis Keys

```
store:{store_id}:status          → "online" | "offline"
store:{store_id}:rgb_state       → JSON { zone -> { colour, brightness, mode } }
store:{store_id}:content_state   → JSON { screen_id -> { playlist_id, asset_id, timestamp } }
store:{store_id}:heartbeat       → timestamp (SETEX 60s)
screen:{screen_id}:heartbeat     → timestamp (SETEX 60s)
screen:{screen_id}:content_hash  → SHA256 of current content manifest
user:{user_id}:session           → JWT payload
org:{org_id}:stores              → Set of store_ids
org:{org_id}:users               → Set of user_ids
```

---

## 9. API Contract Summary

### 9.1 REST API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/login` | Firebase auth exchange | Public |
| POST | `/api/v1/auth/refresh` | Refresh JWT | Bearer |
| GET | `/api/v1/stores` | List stores (scoped) | Bearer |
| GET | `/api/v1/stores/{id}` | Store detail | Bearer + scope |
| GET | `/api/v1/stores/{id}/screens` | Screens in store | Bearer + scope |
| GET | `/api/v1/stores/{id}/led-zones` | LED zones in store | Bearer + scope |
| POST | `/api/v1/rgb/set` | Set RGB colour | Bearer + scope |
| GET | `/api/v1/rgb/presets` | List colour presets | Bearer + scope |
| POST | `/api/v1/rgb/presets` | Create preset | Bearer + hq_admin |
| POST | `/api/v1/rgb/schedules` | Create schedule | Bearer + scope |
| GET | `/api/v1/content/assets` | List content assets | Bearer + scope |
| POST | `/api/v1/content/assets` | Upload/create asset | Bearer + scope |
| GET | `/api/v1/content/templates` | List templates | Bearer |
| GET | `/api/v1/content/playlists` | List playlists | Bearer + scope |
| POST | `/api/v1/content/playlists` | Create playlist | Bearer + scope |
| POST | `/api/v1/content/playlists/assign` | Assign to screens | Bearer + scope |
| GET | `/api/v1/screens/{id}/preview` | Live screen preview | Bearer + scope |
| GET | `/api/v1/analytics/impressions` | Impression data | Bearer + scope |
| GET | `/api/v1/analytics/footfall` | Footfall data | Bearer + scope |
| GET | `/api/v1/activity-log` | Audit trail | Bearer + hq_admin |

### 9.2 WebSocket Events (Dashboard ↔ API)

| Event | Direction | Payload |
|-------|-----------|---------|
| `store:heartbeat` | Server → Client | `{ store_id, timestamp, screen_count, led_zone_count }` |
| `store:rgb_change` | Server → Client | `{ store_id, zone, colour, brightness, mode, changed_by }` |
| `store:content_change` | Server → Client | `{ store_id, screen_id, playlist_id, asset_id }` |
| `screen:status_change` | Server → Client | `{ screen_id, status: "online" | "offline" }` |
| `screen:discovered` | Server → Client | `{ store_id, screen_id, mac_address, type }` |
| `command:ack` | Server → Client | `{ command_id, status: "delivered" | "failed", error? }` |
| `command:send` | Client → Server | `{ command_id, type: "rgb" | "content", payload }` |

### 9.3 MQTT Topics (Edge ↔ Cloud)

| Topic | Direction | Payload |
|-------|-----------|---------|
| `chromacommand/store/{id}/rgb/set/{zone}` | Cloud → Edge | `{ colour, brightness, mode, speed, fade_ms }` |
| `chromacommand/store/{id}/rgb/state/{zone}` | Edge → Cloud | `{ zone, colour, brightness, mode, timestamp }` |
| `chromacommand/store/{id}/content/playlist` | Cloud → Edge | `{ playlist_id, items: [...], hash }` |
| `chromacommand/store/{id}/content/state` | Edge → Cloud | `{ screen_id, playlist_id, asset_id, timestamp }` |
| `chromacommand/store/{id}/telemetry/heartbeat` | Edge → Cloud | `{ store_id, timestamp, uptime_s, version }` |
| `chromacommand/store/{id}/telemetry/sensors` | Edge → Cloud | `{ footfall_1h, avg_queue_min, temperature_c, timestamp }` |
| `chromacommand/store/{id}/screens/discover` | Edge → Cloud | `{ mac, type, dimensions, firmware }` |
| `chromacommand/store/{id}/screens/register` | Cloud → Edge | `{ screen_id, initial_playlist_id }` |

---

## 10. Streaming Strategy

### 10.1 Content Delivery

| Content Type | Delivery Method | Latency Target |
|--------------|----------------|----------------|
| Menu pricing updates | Diff sync over MQTT + HTTPS | < 30s |
| Promo slides (images) | CDN (Cloudflare R2) | < 5s after asset upload |
| Sponsor video loops | CDN + local cache | Pre-cached, < 1s switch |
| Emergency override | MQTT direct to edge | < 2s |
| Live sensor data | MQTT telemetry | < 5min aggregated |

### 10.2 Bandwidth Budget (Per Store)

| Stream | Direction | Rate | Monthly |
|--------|-----------|------|---------|
| Heartbeat | Edge → Cloud | 30s interval, 200B | ~17MB |
| RGB commands | Cloud → Edge | On demand, 500B | ~5MB (avg) |
| RGB state ack | Edge → Cloud | On change, 500B | ~10MB |
| Content diff sync | Bidirectional | Every 60s, 1-50KB | ~2GB |
| Telemetry (sensors) | Edge → Cloud | 5min batch, 2KB | ~17MB |
| Asset download | Cloud → Edge | On change, 1-10MB | ~5GB (varies) |
| **Total** | | | **~7-10GB/month** |

SA Business ADSL/4G typically provides 50-100GB/month — well within budget.

### 10.3 CDN Strategy

- **Primary**: Cloudflare R2 (free egress, af-south-1 edge)
- **Fallback**: Direct HTTPS from API server
- **Asset pipeline**: Upload → API validates → compress/resize → write to R2 → invalidate cache → notify stores via MQTT

---

## 11. Hardware Integration Notes

### 11.1 Per-Store Hardware BOM

| Component | Unit Cost (ZAR) | Qty | Total |
|-----------|-----------------|-----|-------|
| Lenovo ThinkCentre Tiny M90q (edge gateway) | R8,500 | 1 | R8,500 |
| Raspberry Pi 5 8GB + PoE HAT + case | R2,200 | 1 | R2,200 |
| Visionect E-Ink 12" (menu board) | R4,500 | 2 | R9,000 |
| 32" Commercial LCD (promo board) | R6,500 | 1 | R6,500 |
| ESP32-S3 DevKit (LED controller) | R120 | 5 | R600 |
| WS2812B LED strip (5m reel) | R350 | 5 | R1,750 |
| LiDAR footfall sensor (VL53L5CX) | R450 | 1 | R450 |
| STM32L4 + ESP32 sensor board | R380 | 1 | R380 |
| UniFi PoE switch (8-port) | R2,800 | 1 | R2,800 |
| UPS (600VA) | R1,200 | 1 | R1,200 |
| Cabling, mounts, enclosure | R3,000 | 1 | R3,000 |
| **Per-Store Total** | | | **R36,380** |

*Note: This is below the R42K budget in existing docs. The difference is contingency for installation labour.*

### 11.2 Edge Gateway Spec (ThinkCentre Tiny M90q)

| Spec | Value |
|------|-------|
| CPU | Intel Core i5-10500T (6-core, 2.3GHz) |
| RAM | 16GB DDR4 |
| Storage | 256GB NVMe SSD |
| TPM | TPM 2.0 (secure boot) |
| Network | Dual Gigabit Ethernet + WiFi 6 |
| OS | Ubuntu Server 24.04 LTS |
| Docker | All services containerised |
| Power | 65W (PoE+ capable) |

### 11.3 LED Controller Firmware (ESP32-S3)

- **Framework**: Arduino + FastLED library
- **Memory**: 8MB PSRAM for large LED arrays
- **Protocol**: ESP-NOW for local mesh, WiFi for gateway comms
- **OTA**: Receive firmware updates via MQTT → gateway → ESP-NOW
- **Failsafe**: If no command received in 60s, revert to last-colour or default schedule

### 11.4 Screen Player Firmware (Raspberry Pi 5)

- **OS**: Raspberry Pi OS Lite (Bookworm, 64-bit)
- **Runtime**: Node.js 20 + Electron (kiosk mode)
- **Display**: X11/Wayland + Chromium in kiosk mode
- **Cache**: SQLite for content manifest + filesystem for assets
- **OTA**: System update via `apt` + Docker image pull
- **Failsafe**: If no content assigned, show Papa Pasta native menu

---

## 12. Security Model

### 12.1 Authentication

- **Primary**: Firebase Authentication (email/password, Google OAuth)
- **Token**: JWT with custom claims for `role`, `org_id`, `scope`
- **Refresh**: 1-hour access token, 7-day refresh token
- **Session**: Redis-backed session store with 30min idle timeout

### 12.2 Authorization

- **API Gateway**: Fastify `@fastify/jwt` plugin validates Bearer token
- **Scope Checking**: Every endpoint extracts `target_id` from request and checks against user's `scope` array
- **RLS**: PostgreSQL row-level security enforces store-scoped queries

### 12.3 Network Security

- **MQTT**: TLS 1.3 on port 8883, client certificates per edge gateway
- **VLAN**: Store network segmented (POS isolated from IoT from signage)
- **Firewall**: UFW on Ubuntu + UniFi gateway rules
- **POPIA**: All telemetry data aggregated by default; individual data only with opt-in consent

### 12.4 Data Encryption

- **At rest**: PostgreSQL encrypted with LUKS; Redis persistence disabled (ephemeral)
- **In transit**: TLS 1.3 for all HTTPS/WSS/MQTT
- **Asset storage**: Cloudflare R2 with SSE-S3 encryption

---

## 13. Deployment Architecture

### 13.1 Cloud Infrastructure

| Service | Technology | Hosting |
|---------|-----------|---------|
| API Server | Node.js + Fastify | AWS EKS / DigitalOcean K8s |
| Dashboard | Next.js 14 (App Router) | Vercel |
| PostgreSQL | PostgreSQL 16 | AWS RDS / DigitalOcean Managed |
| Redis | Redis 7 (cluster) | AWS ElastiCache / Upstash |
| MQTT Broker | HiveMQ / EMQX | Self-hosted on EC2 / DO Droplet |
| CDN | Cloudflare R2 | Cloudflare |
| Object Storage | Cloudflare R2 + AWS S3 (backup) | Cloudflare + AWS |
| Monitoring | Prometheus + Grafana | Self-hosted |
| Logging | Loki + Grafana | Self-hosted |

### 13.2 Kubernetes Deployment

```yaml
# Simplified deployment spec
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chromacommand-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chromacommand-api
  template:
    metadata:
      labels:
        app: chromacommand-api
    spec:
      containers:
      - name: api
        image: targetpraks/chromacommand-api:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom: { secretKeyRef: { name: db-credentials, key: url } }
        - name: REDIS_URL
          valueFrom: { secretKeyRef: { name: redis-credentials, key: url } }
        - name: MQTT_BROKER_URL
          value: "mqtts://broker.chromacommand.io:8883"
        - name: FIREBASE_PROJECT_ID
          value: "chromacommand-prod"
```

### 13.3 Edge Deployment

Each store's ThinkCentre Tiny is provisioned with:

1. **Ubuntu Server 24.04** flashed to NVMe
2. **Docker + Docker Compose** installed
3. **Compose stack** pulled from GitHub release:
   - `mqtt-client` (Python/paho-mqtt)
   - `rgb-controller` (flask API for ESP-NOW bridge)
   - `screen-proxy` (nginx reverse proxy to Pi players)
   - `sensor-aggregator` (Python/Flask for STM32 UART → MQTT)
4. **Systemd services** for Docker auto-start
5. **VPN mesh** (Tailscale or WireGuard) for secure remote management

---

## 14. User Stories

### 14.1 HQ Admin (Ricardo)

> "As HQ admin, I want to change every store's colour to MTN yellow for a sponsor TakeOver at 6 AM Monday, so that the entire network transforms simultaneously without store visits."

**Acceptance:**
- [ ] Select all stores in "Network Overview"
- [ ] Choose "MTN Yellow" preset
- [ ] Set schedule: 2026-05-01 06:00 SAST
- [ ] All 20 stores transition to yellow within 2 seconds of 6 AM
- [ ] Dashboard shows confirmation: 20/20 stores acknowledged

### 14.2 Regional Manager (Cape Town)

> "As a regional manager, I want to update the menu price of Fusilli Napoletana from R89 to R95 across all Cape Town stores, so pricing is consistent without visiting each store."

**Acceptance:**
- [ ] Filter dashboard to "Cape Town" region
- [ ] Edit price in menu template
- [ ] Preview changes on test screen
- [ ] Push to all Cape Town stores
- [ ] All screens show new price within 30 seconds
- [ ] Offline stores receive update when they reconnect

### 14.3 Franchisee (PP-A01)

> "As a franchisee, I want to see if my store's screens and LEDs are online and check footfall for today, so I know if everything is working."

**Acceptance:**
- [ ] Open dashboard, see own store card
- [ ] LED status: 5/5 zones online, colour swatches visible
- [ ] Screen status: 3/3 screens online, current content preview visible
- [ ] Footfall graph shows today's hourly count
- [ ] Temperature log shows R638 compliance (≤5°C)

### 14.4 Sponsor (MTN Marketing)

> "As a sponsor, I want to see how many people saw my TakeOver content today and how many QR scans we got, so I can report ROI to my CMO."

**Acceptance:**
- [ ] Log in as sponsor_viewer role
- [ ] See only stores where MTN TakeOver is active
- [ ] Dashboard shows: impressions today, QR scans, AR dwell time
- [ ] Data refreshes every 5 minutes
- [ ] Export to CSV for reporting

### 14.5 Technician

> "As a technician, I want to remotely restart a crashed screen player at PP-A03 without going to the store."

**Acceptance:**
- [ ] Find PP-A03 in dashboard
- [ ] See screen `promo-board` is offline
- [ ] Click "Restart Player"
- [ ] MQTT command sent to edge gateway
- [ ] Gateway issues `sudo reboot` to Pi 5
- [ ] Screen comes back online within 90 seconds

---

## 15. Acceptance Criteria

### 15.1 MVP (Phase 1 — 8-10 weeks)

| # | Criteria | Test Method |
|---|----------|-------------|
| A1 | RGB colour change reaches a single store in < 500ms | Wireshark + stopwatch |
| A2 | RGB colour change reaches 20 stores simultaneously in < 2s | Load test with 20 edge simulators |
| A3 | Content update reaches any screen in < 30s | Update price, measure screen render time |
| A4 | Store survives 24h internet outage with last config | Unplug WAN, verify content continues |
| A5 | New screen auto-detects and registers in < 2 minutes | Power on new screen, check dashboard |
| A6 | Dashboard shows all stores, screens, RGB states | Visual QA with test data |
| A7 | Role-based access prevents unauthorized control | Penetration test per role |
| A8 | 7-day content cache survives power cycle | Reboot player, verify content loads from cache |

### 15.2 Phase 2 (4-6 weeks)

| # | Criteria | Test Method |
|---|----------|-------------|
| A9 | Schedule executes automatically at set times | Set schedule, verify execution |
| A10 | Diff sync reduces bandwidth vs full push by > 80% | Monitor MQTT bytes transferred |
| A11 | Sponsor impression logging matches POS data | Compare dashboard impressions vs POS receipts |
| A12 | Analytics dashboard exports CSV/PDF | Export test, verify data accuracy |

### 15.3 Phase 3 (Ongoing)

| # | Criteria | Test Method |
|---|----------|-------------|
| A13 | System scales to 100 stores without latency degradation | Load test with 100 simulated edge gateways |
| A14 | OTA firmware update succeeds on 95%+ of devices | Deploy test firmware, measure success rate |
| A15 | Multi-region support (Cape Town + JHB + Durban) | Deploy to 3 regions, verify isolation |

---

## 16. Development Phases

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| **P0: Foundation** | Weeks 1-2 | Repo, CI/CD, DB schema, MQTT broker | GitHub repo, Docker Compose local dev, DB migrations |
| **P1: RGB Module** | Weeks 3-5 | LED control, presets, schedules, ESP32 firmware | Working RGB control for 1 test store |
| **P2: Content Module** | Weeks 4-6 | Content assets, playlists, player app, diff sync | Working menu display for 1 test store |
| **P3: Dashboard** | Weeks 6-8 | Next.js dashboard, auth, real-time updates, RBAC | Functional dashboard with all core views |
| **P4: Integration** | Weeks 8-9 | Connect RGB + Content + Dashboard, end-to-end test | Full system test with 3 simulated stores |
| **P5: Pilot Deploy** | Weeks 10-12 | PP-A01 deployment, tuning, documentation | Live system at PP-A01,运维 docs |
| **P6: Scale** | Months 4-6 | Roll out to all stores, sponsor dashboard | 10+ stores live |

---

## 17. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SA internet instability | High | High | Local caching + offline mode is core design |
| ESP32 WiFi interference in commercial kitchen | Medium | Medium | ESP-NOW mesh + RS-485 wired fallback |
| E-Ink display refresh rate too slow for video | Low | Medium | E-Ink is for static menu only; use LCD for video |
| Firebase Auth pricing at scale | Low | High | Budget monitoring + self-hosted auth fallback |
| MQTT broker bottleneck at 100+ stores | Medium | Medium | Horizontal scaling with EMQX cluster |
| Franchisee resistance to remote control | Medium | Medium | Franchisee can override store-level; HQ only sets defaults |
| POPIA compliance for sensor data | High | Medium | Aggregate by default, no PII without opt-in |

---

## 18. Glossary

| Term | Definition |
|------|------------|
| **ChromaCommand** | This platform — unified RGB + digital menu control |
| **TakeOver** | A sponsor's complete store transformation (colours, content, cups, AR) |
| **Edge Gateway** | Lenovo ThinkCentre Tiny at each store — bridges local IoT to cloud |
| **ESP-NOW** | Espressif's low-latency wireless protocol (no WiFi router needed) |
| **Diff Sync** | Only sending changed content assets, not full playlists |
| **POPIA** | South Africa's Protection of Personal Information Act |
| **R638** | SA regulation for food safety (temperature logging required) |
| **E-Ink** | Electronic paper display — ultra-low power, sunlight-readable |
| **ESP32-S3** | WiFi + Bluetooth microcontroller used for LED control |
| **WS2812B** | Addressable RGB LED strip (5V, each LED individually controllable) |

---

## 19. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-04-24 | Atlas (Hermes Agent) | Initial PRD based on Coda docs 2DRuePE-Zb, Briefing & Lead Capture UX, Technical Architecture |

**Source Documents:**
- INFX Media — Papa Pasta Media (`coda://docs/2DRuePE-Zb`)
- Technical Architecture (`canvas-nRZ9yW1Muy`)
- Briefing & Lead Capture UX (`canvas-Io8peObJXb`)
- RGB Lighting Control System page (placeholder in Coda)
- Digital Menu Display Manager page (placeholder in Coda)
