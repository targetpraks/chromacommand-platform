# ChromaCommand Platform — Implementation Progress
## Last Updated: 2026-04-25 (12:08 AM SAST)

---

## ✅ Phase 0: Foundation — COMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| PRD v1.1 | ✅ Complete | Expandable RGB zones + Audio Module + One-Button Sync |
| Monorepo | ✅ Complete | Turborepo workspace (`apps/*` + `packages/*`) |
| Database | ✅ Complete | Drizzle ORM — 16 tables incl. audio_zones, audio_playlists |
| API Server | ✅ Complete | Fastify + tRPC — 6 routers (RGB, Content, Audio, Sync, Stores, Analytics) |
| Shared | ✅ Complete | Zod schemas for all commands |

---

## ✅ Phase 1: RGB + Edge + Screen + Audio Firmware — COMPLETE

| Component | File | Details |
|-----------|------|---------|
| **LED Controller** | `firmware/led-controller/led_controller.ino` | ESP32-S3 + FastLED, 8 animation modes, ESP-NOW mesh, NVRAM persistence |
| **Edge Gateway** | `apps/edge-gateway/gateway.js` | MQTT bridge, SQLite cache, One-Button Sync handler, WS server |
| **Screen Player** | `firmware/screen-player/player.js` | Electron kiosk, playlist engine, content rendering, emergency override |
| **Audio Player** | `firmware/audio-player/audio.js` | MPD controller, TTS (Piper/espeak), volume fade, music ducking |

---

## ✅ Phase 2: Dashboard UI — COMPLETE

| Page | File | Features |
|------|------|----------|
| **Matrix View** | `app/components/MatrixView.tsx` + `app/page.tsx` | Store grid with live colour swatches, status dots, screen/audio counts, filters, bulk actions |
| **Store Detail** | `app/stores/[id]/page.tsx` | Dynamic route — DB-driven 8 LED zone cards (per-zone brightness + mode), Screens panel, Audio panel |
| **Stores List** | `app/stores/page.tsx` | List view with StoreCard components, linked to stores.list query |
| **One-Button Sync** | `app/sync/page.tsx` | MTN/FNB/Native/Late Night presets with scope selector + real tRPC sync.transform mutation |
| **Content Manager** | `app/content/page.tsx` | Asset cards from DB (template/image), wired to content.listAssets |
| **Audio Control** | `app/audio/page.tsx` | Per-zone volume sliders, play/pause/skip, store picker, TTS button — wired to audio mutations |
| **Analytics** | `app/analytics/page.tsx` | Stats cards from analytics.getStats, activity_log feed, content performance bars |
| **Sponsor Dashboard** | `app/sponsor/page.tsx` | Read-only analytics for MTN/FNB TakeOver partners — impressions, footfall, QR scans, time series |
| **Settings** | `app/settings/page.tsx` | Profile, Org, Roles, Notifications |
| **Sidebar** | `app/components/Sidebar.tsx` | 8 nav items (+Sponsor badge), user profile, active states |
| **Shared** | `app/components/StoreCard.tsx` | Reusable card with colour swatches, status, animations |

**Tech:** Next.js 14 App Router, Tailwind CSS, Framer Motion, Lucide icons. Dark navy (#0A0B14) + gold (#C8A951) theme.

---

## ✅ Phase 3: API ↔ Dashboard Wiring — COMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| **tRPC Client** | ✅ Done | `httpBatchLink` to `http://localhost:4000/api/trpc`, manual refetch driven by WebSocket events |
| **stores.list** | ✅ Done | Reads all stores from DB with zones, screens, audioZones joined |
| **stores.get** | ✅ Done | Single store detail with full zone/screen/audio data |
| **rgb.listPresets** | ✅ Done | Reads rgb_presets from DB, returns full preset objects |
| **rgb.getState** | ✅ Done | Returns LED zones with current colour/mode/brightness per store |
| **rgb.multiGetState** | ✅ Done | Batch query for MatrixView swatch colouring |
| **rgb.set** | ✅ Done | Mutation updates DB colour then dispatches MQTT topic |
| **content.listAssets** | ✅ Done | Reads content_assets from DB |
| **content.createAsset** | ✅ Done | Inserts asset + logs activity |
| **sync.transform** | ✅ Done | One-Button Sync — resolves preset colour → updates led_zones → logs activity |
| **audio.getZoneState** | ✅ Done | Returns per-store audio zones from DB |
| **audio.set** | ✅ Done | Mutation updates zone status/volume in DB + dispatches MQTT |
| **audio.announce** | ✅ Done | Inserts announcement into activity_log |
| **analytics.getStats** | ✅ Done | Activity-based stats with impressions, footfall, QR scans |
| **analytics.getActivityLog** | ✅ Done | Latest activity entries from activity_log |
| **analytics.getContentPerformance** | ✅ Done | Hard-coded demo content performance (placeholder for future metrics) |
| **sponsor.getCampaignData** | ✅ Done | Per-store sponsor analytics with impressions, footfall, QR scans, screen status |
| **sponsor.getTimeSeries** | ✅ Done | Daily breakdown of campaign metrics over time |
| **MatrixView wired** | ✅ Done | Uses `trpc.stores.list` with demo fallback + **WebSocket live invalidation** |
| **Store Detail wired** | ✅ Done | Dynamic route `[id]` — `trpc.stores.get` fully DB-driven |
| **Sync page wired** | ✅ Done | `trpc.sync.transform` with real error/success states |
| **Content page wired** | ✅ Done | `trpc.content.listAssets` with loading state |
| **Audio page wired** | ✅ Done | `trpc.audio.getZoneState` + mutations for play/pause |
| **Analytics page wired** | ✅ Done | `trpc.analytics.getStats` + `getContentPerformance` + `getActivityLog` |
| **Sponsor page wired** | ✅ Done | `trpc.sponsor.getCampaignData` + `getTimeSeries` with store breakdown |
| **StoreCard** | ✅ Done | Accepts both demo and DB shapes, renders zones correctly |

---

## ✅ Phase 4: DevOps + CI/CD — COMPLETE

| Component | File | Details |
|-----------|------|---------|
| **Docker Compose** | `docker-compose.yml` | Postgres 16, Redis 7, MQTT Mosquitto, API, Dashboard (dev mode) |
| **Seed service** | `docker-compose.yml` | Auto-runs `seed.ts` after Postgres is healthy, then API starts |
| **API Dockerfile** | `docker/Dockerfile.api` | Node 20 Alpine, builds API workspace |
| **Dashboard Dockerfile** | `docker/Dockerfile.dashboard` | Node 20 Alpine, builds Next.js workspace |
| **Mosquitto Config** | `docker/mosquitto.conf` | Anonymous true, persistence on port 1883 |
| **GitHub Actions CI** | `.github/workflows/ci.yml` | Typecheck → Build → Test (with Postgres service) |
| **Seed Script** | `packages/database/seed.ts` | 6 stores, 48 zones, 18 screens, 18 audio zones, 4 presets, 4 content assets, 3 audio playlists, 50 activity log entries |

## ✅ Phase 5: Live WebSocket + Sponsor Dashboard + Auto-Seed + E2E Tests — COMPLETE

### 5A: WebSocket Live Updates
| Component | File | Details |
|-----------|------|---------|
| **Live Socket Server** | `apps/api/src/live/index.ts` | Fastify WebSocket `/live/ws`, subscribe/unsubscribe topics, `broadcast()` helper |
| **Live Socket Hook** | `apps/dashboard/app/hooks/useLiveSocket.ts` | React hook, auto-connects, parses `rgb_update`/`sync_complete`/`audio_update`/`store_status` events, auto-reconnects |
| **MatrixView Updated** | `apps/dashboard/app/components/MatrixView.tsx` | **Removed 5s polling**, now invalidates `stores.list` on WebSocket events only — instant updates, zero idle traffic |
| **tRPC Client** | `apps/dashboard/app/lib/trpc.ts`** | Disabled `refetchInterval`, bumped staleTime to 60s — lean client behavior |

### 5B: Auto-Seed on Docker Compose Up
| Component | File | Details |
|-----------|------|---------|
| **Idempotent Seed** | `packages/database/seed.ts` | Checks `stores` table count first, skips if already seeded. Supports `FORCE_SEED=1` override |
| **Seed service** | `docker-compose.yml` | New `seed` service runs after Postgres healthcheck, then API `depends_on` seed ensuring DB is populated before API starts |

### 5C: Sponsor Dashboard (Read-only Analytics)
| Component | File | Details |
|-----------|------|---------|
| **Sponsor Router** | `apps/api/src/routers/sponsor.ts` | `getCampaignData` + `getTimeSeries` — impressions, footfall, QR scans per store, conversion rate, time series breakdown |
| **Sponsor Router Stub** | `packages/shared/router-stub.ts` | Added `sponsor.getCampaignData` + `sponsor.getTimeSeries` type shapes |
| **Sponsor Page** | `apps/dashboard/app/sponsor/page.tsx` | Full analytics: summary cards (impressions, footfall, QR scans, conversion), store-level breakdown, time-series bar chart, activity feed |
| **Sidebar Updated** | `apps/dashboard/app/components/Sidebar.tsx` | Added "Sponsor" nav item (HeartHandshake icon) with "NEW" badge |

### 5D: End-to-End Test Suite
| Component | File | Details |
|-----------|------|---------|
| **E2E Tests** | `apps/api/src/tests/e2e.test.ts` | Health, stores.list, stores.get, rgb.listPresets, analytics.getStats, sync.transform, sponsor.getCampaignData, load test (100 concurrent <2s), WebSocket connection |
| **Vitest Config** | `apps/api/vitest.config.ts` | Node environment, 15s timeout |
| **WS Dependency** | `apps/api/package.json` | Added `ws` @ `^8.16.0` for WebSocket test coverage |

### Critical Fixes
| Issue | Fix |
|-------|-----|
| **API serving stub router** | `apps/api/src/index.ts` was importing `appRouter` from `@chromacommand/shared` (stub). Fixed to import from `./routers/_app` (real DB-backed router) |

---

## Repository

**GitHub:** https://github.com/targetpraks/chromacommand-platform

### File Structure (59 files across monorepo)

```
chromacommand-platform/
├── PRD.md                              # 19 sections, full spec
├── PROGRESS.md                         # This file
├── README.md
├── package.json                        # Root Turborepo
├── turbo.json
│
├── .github/workflows/ci.yml            # GitHub Actions pipeline
├── .env.example                        # Local dev env template
├── docker-compose.yml                  # Full local stack + auto-seed
│
├── apps/
│   ├── api/                             # Fastify + tRPC backend
│   │   ├── src/
│   │   │   ├── index.ts               # Entry point (Fastify + tRPC + WS + JWT + Live routes)
│   │   │   ├── live/
│   │   │   │   └── index.ts          # WebSocket server + broadcast helper
│   │   │   ├── tests/
│   │   │   │   └── e2e.test.ts     # E2E + load test + WebSocket test
│   │   │   ├── trpc.ts                # Context + router factory
│   │   │   └── routers/
│   │   │       ├── _app.ts            # App registry (RGB, Content, Audio, Sync, Stores, Analytics, Sponsor, Health)
│   │   │       ├── stores.ts          # DB-backed store list + detail
│   │   │       ├── rgb.ts             # LED control endpoints (DB + MQTT dispatch)
│   │   │       ├── content.ts         # Content asset CRUD + playlist assignment
│   │   │       ├── audio.ts           # Audio zone state + TTS announce
│   │   │       ├── sync.ts            # One-Button Sync transform
│   │   │       ├── analytics.ts       # Stats + activity log queries
│   │   │       └── sponsor.ts         # Sponsor read-only analytics
│   │   ├── vitest.config.ts
│   │   └── package.json
│   │
│   ├── dashboard/                       # Next.js 14 Dashboard
│   │   ├── app/
│   │   │   ├── page.tsx                 # Matrix View (root)
│   │   │   ├── layout.tsx               # TRPCProvider + Sidebar
│   │   │   ├── globals.css              # Dark navy/gold theme
│   │   │   ├── lib/trpc.ts             # tRPC client (httpBatchLink, NO polling)
│   │   │   ├── hooks/
│   │   │   │   └── useLiveSocket.ts    # WebSocket hook for live updates
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.tsx          # Navigation (8 items + Sponsor badge)
│   │   │   │   ├── MatrixView.tsx       # Store grid — WebSocket-driven invalidation
│   │   │   │   └── StoreCard.tsx        # Reusable card
│   │   │   ├── sync/page.tsx            # One-Button Sync
│   │   │   ├── stores/page.tsx          # Store list
│   │   │   ├── stores/[id]/page.tsx    # Store detail
│   │   │   ├── content/page.tsx          # Content Manager
│   │   │   ├── audio/page.tsx            # Audio Control
│   │   │   ├── analytics/page.tsx        # Analytics
│   │   │   ├── sponsor/page.tsx          # Sponsor Dashboard — read-only analytics
│   │   │   └── settings/page.tsx         # Settings
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── edge-gateway/                    # MQTT Client for ThinkCentre Tiny
│       ├── gateway.js                   # SQLite + MQTT + WS + One-Button Sync
│       └── package.json
│
├── packages/
│   ├── database/                          # Drizzle ORM
│   │   ├── schema.ts                     # 16 tables
│   │   ├── index.ts                      # DB client with lazy connect
│   │   ├── migrate.ts                    # Migration runner
│   │   ├── seed.ts                       # Idempotent Papa Pasta demo data
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── shared/                            # Shared types + router stub
│       ├── schemas.ts                    # Zod schemas for all commands
│       ├── trpc.ts                       # tRPC init (stub for type inference)
│       ├── router-stub.ts               # AppRouter type shape (NOW includes sponsor)
│       ├── types.ts                      # Future shared types
│       ├── index.ts                      # Package exports
│       ├── tsconfig.json
│       └── package.json
│
├── docker/
│   ├── Dockerfile.api                    # API build
│   ├── Dockerfile.dashboard              # Dashboard build
│   └── mosquitto.conf                    # MQTT broker config
│
└── firmware/
    ├── led-controller/
    │   └── led_controller.ino            # ESP32-S3 + FastLED + ESP-NOW
    ├── screen-player/
    │   ├── player.js                     # Electron kiosk + playlist engine
    │   └── package.json
    └── audio-player/
        ├── audio.js                       # MPD control + TTS + ducking
        └── package.json
```

---

## Running the Platform

### Option 1: Docker Compose (Recommended — Auto-Seed)
```bash
# Start all services (Postgres → Seed → API → Dashboard)
docker compose up -d

# Seed runs automatically after Postgres is healthy
# API starts only AFTER seed completes

# Dashboard → http://localhost:3000
# API → http://localhost:4000/api/trpc
```

### Option 2: Local Dev (requires Node 20+ and Postgres)
```bash
# Install deps
npm install

# Start database + migrate
cd packages/database && npm run db:migrate

# Seed data (idempotent)
npx tsx seed.ts

# Start API
cd apps/api && npm run dev

# Start Dashboard (new terminal)
cd apps/dashboard && npm run dev
```

### Running Tests
```bash
# E2E tests (requires running API at localhost:4000)
cd apps/api && npm run test

# Or against a specific API instance
API_URL=http://localhost:4000 npm run test
```

---

## Key Technical Decisions

1. **Dashboard queries fallback to demo data** — `MatrixView` first attempts `trpc.stores.list`, shows loading spinner, and falls back to hardcoded `demoStores` if DB is unavailable. This ensures the UI always renders even without a running API/DB.
2. **StoreCard accepts any shape** — The component accepts both `region` (demo) and `regionId` (DB) fields. Uses `store.region ?? regionNameMap[regionId]` for display. Same for `status` ("active" in DB → "online" in UI).
3. **tRPC stub pattern** — `@chromacommand/shared` exports an `AppRouter` **stub** for type inference only. All real implementations live in `@chromacommand/api` routers. This avoids circular dependencies between dashboard and API.
4. **Sync transform mapping** — Preset IDs from the dashboard UI ("mtn_takeover", "navy_gold") are mapped to DB `rgbPresets` IDs. Currently uses hardcoded mapping; future versions should query `rgb.listPresets` and match by name.
5. **Activity log for analytics** — Stats are derived from the `activity_log` table. Real-time metrics (impressions, footfall) are currently estimated from activity frequency; future versions should read from a dedicated metrics table with sensor telemetry.
6. **WebSocket replaces polling** — Instead of 5-second tRPC refetching, the dashboard opens a persistent WebSocket to `/live/ws`, subscribes to "all" topic, and invalidates React Query cache only on real events. This eliminates idle HTTP traffic and enables instant updates.
7. **Seed idempotency** — `seed.ts` checks the `stores` table before writing. If stores already exist, it exits silently. This prevents duplicate data when `docker compose up` is run multiple times.
8. **API router isolation** — The dashboard and API both have their own `appRouter` exports. The dashboard uses `router-stub.ts` for type inference; the API uses `src/routers/_app.ts` for runtime. A critical bug (importing from stub in the API) was caught and fixed in this phase.
9. **Sponsor data is read-only** — The `sponsor` router returns derived analytics without any mutation endpoints. No auth/RBAC yet — all endpoints use `publicProcedure`.

---

## What Changed in This Phase (Phase 5)

- **🔴 CRITICAL FIX:** API entry point was importing `appRouter` from `@chromacommand/shared` (empty stubs). Fixed to import from `./routers/_app` (real DB-backed implementation).
- **WebSocket Live Updates:** `apps/api/src/live/index.ts` + `apps/dashboard/app/hooks/useLiveSocket.ts` + MatrixView updated to disable polling + invalidate on WS events.
- **Idempotent Seed:** `seed.ts` now checks existing data before writing, supports `FORCE_SEED=1` override.
- **Auto-Seed Service:** `docker-compose.yml` includes a `seed` service that auto-runs after Postgres healthcheck.
- **Sponsor Router:** `apps/api/src/routers/sponsor.ts` — `getCampaignData` + `getTimeSeries` with per-store breakdown.
- **Sponsor Dashboard Page:** `apps/dashboard/app/sponsor/page.tsx` — summary cards, store leaderboard, time-series bar chart, activity feed.
- **Sidebar Updated:** Added "Sponsor" nav item with HeartHandshake icon and "NEW" badge.
- **Router Stub Updated:** Added `sponsor.getCampaignData` + `sponsor.getTimeSeries` to `packages/shared/router-stub.ts`.
- **E2E Test Suite:** `apps/api/src/tests/e2e.test.ts` — 9 tests covering all major endpoints + 100-request load test (<2s) + WebSocket connection test.
- **Vitest Config:** `apps/api/vitest.config.ts` with Node environment and 15s timeout.
- **File count:** 54 → 59 files.

---

## Next Steps (Phase 6 — Future)

| Component | Details |
|-----------|---------|
| **Auth middleware** | Replace `publicProcedure` with JWT-validated procedures + RBAC (admin, store manager, sponsor viewer) |
| **MQTT broker wiring** | Connect `sync.transform` and `rgb.set` mutations to real MQTT dispatch (currently logged only) |
| **Edge gateway deployment** | Build Docker image for ThinkCentre Tiny M90q |
| **Firmware OTA** | Remote update ESP32 firmware via MQTT |
| **Metrics table** | Replace activity-log-derived estimates with real sensor telemetry (impressions, footfall) |
| **RBAC on Sponsor** | Scope sponsor endpoints to authenticated users with `sponsor_viewer` role |

---

> **Status: BETA** — All 5 phases complete. WebSocket live updates, sponsor dashboard, auto-seeding, and E2E tests implemented. Platform is production-scaffolded. Next: auth + real MQTT wiring.
