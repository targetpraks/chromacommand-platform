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

---

## ✅ Phase 6: Auth/RBAC + Real MQTT + Telemetry — COMPLETE (2026-04-25)

### 6A: Auth + RBAC
| Component | File | Details |
|-----------|------|---------|
| **Auth core** | `apps/api/src/auth.ts` | JWT sign/verify (`jsonwebtoken`), `protectedProcedure`, `requireScope(resolver)`, `requireRole(...)` middlewares |
| **Auth router** | `apps/api/src/routers/auth.ts` | `auth.login` (issues JWT), `auth.me` (current user) |
| **Scope helpers** | `apps/api/src/scope.ts` | `scopeFromRequest`, `scopeForStore`, `scopeForRegion` — translate dashboard inputs into JWT scope strings |
| **Context** | `apps/api/src/trpc.ts` | `createContext` now parses Authorization header → `ctx.user` |
| **Routers gated** | `rgb`, `audio`, `sync`, `content`, `analytics`, `stores`, `sponsor`, `telemetry` | All queries require auth; mutations require scope or role |
| **Sponsor router** | `apps/api/src/routers/sponsor.ts` | Now `requireRole("hq_admin", "sponsor_viewer", "regional_manager")` |
| **Login page** | `apps/dashboard/app/login/page.tsx` | Email + password form with quick-fill for seeded roles |
| **Dashboard client** | `apps/dashboard/app/lib/trpc.ts` | Attaches `Authorization: Bearer <jwt>` from localStorage to every tRPC call |
| **Demo users** | `packages/database/seed.ts` | 6 users: hq_admin (Ricardo, scope=`*`), Cape Town RM, Joburg RM, PP-A01 franchisee, MTN sponsor, Field tech |

### 6B: Real MQTT Dispatch
| Component | File | Details |
|-----------|------|---------|
| **MQTT client** | `apps/api/src/mqtt.ts` | Singleton long-lived `mqtt.connect()` with auto-reconnect (5s), pending queue (5000 msg cap) drained on connect |
| **publishCommand** | `apps/api/src/mqtt.ts` | `publishCommand(topic, payload, qos)` — used by `rgb.set`, `sync.transform`, `audio.set`, `audio.announce` |
| **Inbound subscriber** | `apps/api/src/mqtt.ts` | Subscribes to `chromacommand/store/+/telemetry/+`, `…/rgb/state/+`, `…/screens/discover` and writes to DB |
| **API entry** | `apps/api/src/index.ts` | Calls `initMqtt()` non-fatally — commands queue if broker is down |
| **Env** | `.env.example` | `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `JWT_TTL`, `DASHBOARD_ORIGIN`, `NEXT_PUBLIC_API_URL` |

### 6C: Sensor Telemetry
| Component | File | Details |
|-----------|------|---------|
| **Schema** | `packages/database/schema.ts` | `sensor_telemetry` (bigserial id, store_id, sensor_id, metric, value::float8, recorded_at) + 2 indexes; `device_heartbeats` (device_id pk); `sync_transactions` (per-One-Button-Sync record for rollback) |
| **Telemetry router** | `apps/api/src/routers/telemetry.ts` | `getSeries` (bucketed via PG `date_bin`), `latest`, `liveDevices`, `ingest` (HTTP fallback for non-MQTT devices, requires technician/hq_admin) |
| **Analytics rewired** | `apps/api/src/routers/analytics.ts` | `getStats` now reads `sensor_telemetry`; only falls back to activity-log estimates if telemetry table is empty (returns `source: "telemetry" \| "estimated"`) |
| **MQTT ingest** | `apps/api/src/mqtt.ts` | `chromacommand/store/{id}/telemetry/sensors` payloads `{samples: [{sensor_id, metric, value, recorded_at}]}` go straight into `sensor_telemetry` |
| **Heartbeat ingest** | `apps/api/src/mqtt.ts` | `chromacommand/store/{id}/telemetry/heartbeat` upserts into `device_heartbeats` |
| **Seed** | `packages/database/seed.ts` | Generates 24h × 6 stores × 4 metrics ≈ 3,000 telemetry samples + 6 gateway heartbeats |

### 6D: Observability
| Component | File | Details |
|-----------|------|---------|
| **Metrics endpoint** | `apps/api/src/metrics.ts` | `GET /metrics` in Prometheus exposition format — `cc_api_requests_total`, `cc_mqtt_publish_total`, `cc_store_online`, `cc_store_last_heartbeat_seconds` |
| **Counter wiring** | `apps/api/src/metrics.ts` | `bumpCounter()` called from `onResponse` hook + from `publishCommand()` |

### 6E: PRD v1.2
| Section | Topic |
|---------|-------|
| §20 | Observability — metrics catalog (12 metrics), 5 SLOs, 3-tier alert routing |
| §21 | MQTT QoS + idempotency — per-topic QoS table, `command_id` ring buffer on edge, One-Button-Sync compensation semantics (no auto-rollback) |
| §22 | Edge gateway provisioning — Ed25519 keypair on device, single-use 8-char codes, mTLS X.509 client certs (365d, auto-renew at -30d), EMQX ACL pattern |
| §23 | Sensor telemetry storage — full DDL for the 2 new tables, ingestion path, retention policy (90d raw → daily aggregates) |

### Migration Note
After pulling: run `cd packages/database && npm run db:generate && npm run db:migrate` to apply the new `sensor_telemetry`, `device_heartbeats`, and `sync_transactions` tables before re-seeding.

### Files Added (10)
- `apps/api/src/auth.ts`
- `apps/api/src/scope.ts`
- `apps/api/src/mqtt.ts`
- `apps/api/src/metrics.ts`
- `apps/api/src/routers/auth.ts`
- `apps/api/src/routers/telemetry.ts`
- `apps/dashboard/app/login/page.tsx`

### Files Modified
- All 7 routers (auth wired in)
- `apps/api/src/index.ts` (MQTT + metrics init)
- `apps/api/src/trpc.ts` (real context)
- `apps/api/package.json` (`jsonwebtoken`)
- `apps/dashboard/app/lib/trpc.ts` (JWT in headers)
- `packages/database/schema.ts` (3 new tables)
- `packages/database/seed.ts` (users + telemetry + heartbeats)
- `packages/shared/router-stub.ts` (auth + telemetry stubs)
- `.env.example`
- `PRD.md` (v1.2 — §20-§24)

> **Status: Phase 6 COMPLETE.** Production-ready auth/RBAC, real MQTT command dispatch with reconnect + queue, sensor telemetry pipeline (MQTT-in → Postgres → tRPC out), Prometheus metrics, and PRD v1.2 covering everything that was implementation-defined.

---

## ✅ Phase 6.1: Auth-aware tests + WS auth + login rate-limit + mTLS support

This is sequential follow-on to Phase 6. Picks up the gaps that were called out in the Phase 6 commit message.

| Action point | File | Details |
|--------------|------|---------|
| **E2E tests log in first** | `apps/api/src/tests/e2e.test.ts` | `beforeAll` logs in two users (HQ + franchisee); existing tests now send `Authorization: Bearer <jwt>`; new test asserts unauth requests return 401 |
| **RBAC negative tests** | `apps/api/src/tests/e2e.test.ts` | franchisee@pp-a01 → `sync.transform(pp-j01)` returns **403**; same call to `pp-a01` returns 200 |
| **Telemetry + metrics tests** | `apps/api/src/tests/e2e.test.ts` | `telemetry.latest`, `analytics.getStats source label`, `/metrics` Prometheus exposition format |
| **Login rate-limit** | `apps/api/src/rate-limit.ts` + `apps/api/src/routers/auth.ts` | In-process token bucket: 10 attempts / 60s per IP **and** per email; 11th request returns `TOO_MANY_REQUESTS` (HTTP 429); test asserts blocking |
| **WebSocket auth** | `apps/api/src/live/index.ts` | `/live/ws?token=…` (or `Authorization` header for server-to-server); unauthorized connections receive `{type:"error",code:"unauthorized"}` then close with code 1008 |
| **WS scope filtering** | `apps/api/src/live/index.ts` | `broadcast()` skips delivery to clients whose JWT scope doesn't cover the event's `storeId` (wildcard `*` and store-level scopes are honoured) |
| **Dashboard WS sends token** | `apps/dashboard/app/hooks/useLiveSocket.ts` | Reads JWT from `localStorage` via `getToken()`, passes as `?token=…`; defers connection if no token (handles pre-login state) |
| **Dashboard route guard** | `apps/dashboard/app/components/AuthGate.tsx` + `AppShell.tsx` | Client-side guard redirects unauthenticated visitors to `/login`; sidebar hidden on the login route |
| **MQTT mTLS** | `apps/api/src/mqtt.ts` | When `MQTT_BROKER_URL` starts with `mqtts://`, loads X.509 client cert / key / CA from `MQTT_CLIENT_CERT` / `MQTT_CLIENT_KEY` / `MQTT_CA_CERT`; `MQTT_INSECURE=1` only for self-signed dev brokers |
| **Env vars** | `.env.example` | `MQTT_CLIENT_CERT`, `MQTT_CLIENT_KEY`, `MQTT_CA_CERT`, `MQTT_INSECURE`, `MQTT_CLIENT_ID` |

### Test Coverage Summary
- **15 test cases** across 8 describe blocks (was 9 in Phase 5)
- Covers: public routes, auth happy path, auth rejection, auth.me, RBAC scope (positive + negative), telemetry, login rate-limit, load test, WS unauth rejection, WS authed connect

### Files Added
- `apps/api/src/rate-limit.ts`
- `apps/dashboard/app/components/AuthGate.tsx`
- `apps/dashboard/app/components/AppShell.tsx`

### Files Modified
- `apps/api/src/tests/e2e.test.ts` (rewritten to use auth)
- `apps/api/src/routers/auth.ts` (rate-limit applied)
- `apps/api/src/live/index.ts` (token verification + scope filtering)
- `apps/api/src/mqtt.ts` (mTLS cert loading)
- `apps/dashboard/app/hooks/useLiveSocket.ts` (sends token)
- `apps/dashboard/app/layout.tsx` (uses AppShell)
- `.env.example`

> **Status: Phase 6.1 COMPLETE.** Auth, RBAC, rate-limiting, and transport security are now end-to-end tested. The platform is no longer trivially exploitable through the WebSocket or login endpoint.

---

## ✅ Phase 6.2: Edge bridge + refresh tokens + migrations + rollback UI

Sequential follow-on. Closes the four "useful next" action points called out at the end of Phase 6.1.

### 6.2A: Edge gateway aligned with v1.2 schema
| Component | File | Change |
|-----------|------|--------|
| **mTLS support** | `apps/edge-gateway/gateway.js` | Loads device cert/key/CA from `MQTT_CLIENT_CERT/KEY/MQTT_CA_CERT` when broker URL is `mqtts://`. Matches PRD §22 |
| **Heartbeat shape** | `apps/edge-gateway/gateway.js` | Now publishes `{device_id, device_type, store_id, ts, ip, version, uptime_s}` so the API's `device_heartbeats` upsert just works |
| **Idempotent commands** | `apps/edge-gateway/gateway.js` | New `command_dedupe` SQLite table acts as a 1000-entry ring buffer per PRD §21.2 — duplicate `command_id` returns ack but doesn't re-apply |
| **Sensor publisher** | `apps/edge-gateway/gateway.js` | New `sensor_buffer` SQLite table. Local devices `POST /api/v1/sensors/ingest` → buffered → flushed every 60s as `{samples: [...]}` to `chromacommand/store/{id}/telemetry/sensors` (qos=1) |
| **Promise wrappers** | `apps/edge-gateway/gateway.js` | `dbRun/dbGet/dbAll` so handlers can `await` cleanly |

### 6.2B: Refresh token rotation
| Component | File | Details |
|-----------|------|---------|
| **Schema** | `packages/database/schema.ts` | `refresh_tokens` table: jti pk, user_id, issued/expires/revoked timestamps, replaced_by_jti, ip + UA |
| **Token signing** | `apps/api/src/auth.ts` | New `signRefreshToken(userId, jti)` (typ=refresh) + `verifyRefreshToken()`. Access token now carries `typ=access` to prevent confusion |
| **Default policy** | `apps/api/src/auth.ts` | **1h access / 30d refresh** — see Phase 6.2 commit message for the trade-off matrix; awaiting operator confirmation |
| **`/auth/refresh`** | `apps/api/src/routers/auth.ts` | Single-use rotation: presents old refresh → issues new pair → marks old jti revoked + replaced_by |
| **Reuse detection** | `apps/api/src/routers/auth.ts` | Presenting an already-revoked refresh = treats as theft, revokes ALL active tokens for that user (OWASP refresh-token rotation pattern) |
| **`/auth/logout`** | `apps/api/src/routers/auth.ts` | Revokes a single refresh jti |
| **`/auth/logoutAll`** | `apps/api/src/routers/auth.ts` | Revokes every active refresh token for the current user |

### 6.2C: Drizzle migrations checked in
| Component | File | Details |
|-----------|------|---------|
| **Baseline** | `packages/database/drizzle/0000_init.sql` | Hand-written equivalent of `drizzle-kit generate` for the entire v1.2 schema — fresh clone goes from zero to provisioned with `npm run db:migrate`, no `db:generate` step |
| **Journal** | `packages/database/drizzle/meta/_journal.json` | Drizzle migration manifest |
| **Idempotency** | All `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` so re-runs don't blow up |

### 6.2D: One-Button Sync rollback UI
| Component | File | Details |
|-----------|------|---------|
| **Transactions recorded** | `apps/api/src/routers/sync.ts` | Every `sync.transform` writes a `sync_transactions` row with `presetIdBefore` (from previous tx for same target) + `presetIdAfter` |
| **`sync.recent`** | `apps/api/src/routers/sync.ts` | Returns the last N tx for a target (or globally) for the rollback UI |
| **`sync.rollback`** | `apps/api/src/routers/sync.ts` | Resolves the prior preset, re-applies via the same MQTT path, records a new tx with `rolledBackFrom` annotation; refuses if there's no prior preset |
| **`<RecentSyncs/>`** | `apps/dashboard/app/components/RecentSyncs.tsx` | Drop-in widget — list with per-row Rollback button, disabled when prior preset is missing or the row was itself a rollback |
| **Sync page** | `apps/dashboard/app/sync/page.tsx` | Renders `<RecentSyncs />` below existing sync controls |

### Files Added
- `packages/database/drizzle/0000_init.sql`
- `packages/database/drizzle/meta/_journal.json`
- `apps/dashboard/app/components/RecentSyncs.tsx`

### Files Modified
- `apps/edge-gateway/gateway.js`
- `apps/api/src/auth.ts`
- `apps/api/src/routers/auth.ts`
- `apps/api/src/routers/sync.ts`
- `packages/database/schema.ts`
- `packages/shared/router-stub.ts`
- `apps/dashboard/app/sync/page.tsx`

### Open Decision (waiting on Ricardo)
**Refresh-token TTL policy** — currently set to 1h access + 30d refresh (option B from the matrix in chat). Will adjust if you pick A (15min/24h) or C (4h/90d).

> **Status: Phase 6.2 COMPLETE.** Edge gateway now ingests cleanly into v1.2 schema; refresh-token rotation closes the "12h stolen-token window" gap; migrations are checked in so deploys are reproducible; operators can roll back any sync transform from the UI.

---

## ✅ Phase 6.3: TTL lock-in + migration audit + endpoint tests + scheduled transitions

Sequential follow-on; finishes the open items at the end of Phase 6.2 plus tackles acceptance criterion **A9** (schedules execute automatically).

### 6.3A: Refresh-token TTL — Policy B locked in
| Component | File | Change |
|-----------|------|--------|
| Defaults | `.env.example` | `JWT_TTL=1h`, `REFRESH_TTL_DAYS=30` (was `12h`/no refresh). One-line comment documents the choice. |

Decision recorded: 1h access + 30d refresh. Operators leave the dashboard open for 8–10h shifts; refresh-token rotation handles silent renewal; `auth.logoutAll` is the kill switch for stolen-laptop scenarios.

### 6.3B: Migration drift audit
| Check | Result |
|-------|--------|
| 18 tables in schema.ts vs. 0000_init.sql | ✅ all present |
| Index parity (sensor_telemetry × 2, refresh_tokens partial) | ✅ matches; the partial-WHERE refresh index is intentionally raw SQL only because Drizzle's index DSL doesn't express partial indexes cleanly |
| Spot-check led_zones column-by-column | ✅ types and defaults match |
| Spot-check users.scope JSONB default `'[]'` | ✅ match |

No drift fix required. The init.sql is faithful to v1.2 schema.

### 6.3C: Tests for new endpoints
| Component | File | Coverage |
|-----------|------|----------|
| **Refresh-token tests** | `apps/api/src/tests/refresh-rollback.test.ts` | login returns both tokens, rotation issues new pair, **reuse detection nukes all sessions**, logout revokes single jti, logoutAll revokes everything |
| **Sync rollback tests** | `apps/api/src/tests/refresh-rollback.test.ts` | transform creates tx, recent returns it, rollback succeeds when prior preset exists, refuses when none |
| **Telemetry ingest tests** | `apps/api/src/tests/refresh-rollback.test.ts` | technician + hq_admin can ingest, **franchisee gets 403**, getSeries returns bucketed data |

11 new test cases on top of the 15 in Phase 6.1 = 26 total.

### 6.3D: Scheduled RGB transitions (PRD acceptance criterion A9)
| Component | File | Details |
|-----------|------|---------|
| **Scheduler runtime** | `apps/api/src/scheduler.ts` | node-cron-driven runner; reads `rgb_schedules` from Postgres; 60s re-sync picks up dashboard CRUD without restart; per-job priority guard prevents lower-priority schedules from firing when a higher-priority one targets the same scope |
| **Conflict resolution** | `apps/api/src/scheduler.ts` | Higher `priority` wins on overlap; `affectsSameStore()` is conservative for region/global overlaps |
| **API entry** | `apps/api/src/index.ts` | `startScheduler()` non-fatal on DB error; `DISABLE_SCHEDULER=1` opts out (e.g. for test instances) |
| **CRUD router** | `apps/api/src/routers/schedules.ts` | `list`, `create` (scope-checked), `update` (admin/RM), `remove` (admin/RM), `activeJobs` (admin/tech debug) |
| **Cron validation** | `apps/api/src/routers/schedules.ts` | `cron.validate()` rejects bad expressions at create/update time, returns 400 |
| **Dashboard page** | `apps/dashboard/app/schedules/page.tsx` | Create form with cron presets dropdown, list with pause/resume/delete, priority editor |
| **Sidebar** | `apps/dashboard/app/components/Sidebar.tsx` | New "Schedules" nav item with NEW badge |
| **Seed** | `packages/database/seed.ts` | Adds 2 paused demo schedules ("Morning Open — Navy & Gold" weekday 06:00, "Late Night Dim" daily 22:00) — paused so they don't fire during tests |
| **Deps** | `apps/api/package.json` | `node-cron@^3.0.3`, `@types/node-cron` |

### Files Added
- `apps/api/src/scheduler.ts`
- `apps/api/src/routers/schedules.ts`
- `apps/api/src/tests/refresh-rollback.test.ts`
- `apps/dashboard/app/schedules/page.tsx`

### Files Modified
- `.env.example` (TTL policy)
- `apps/api/src/index.ts` (scheduler init)
- `apps/api/src/routers/_app.ts` (mount schedules router)
- `apps/api/package.json` (node-cron)
- `apps/dashboard/app/components/Sidebar.tsx` (Schedules nav)
- `packages/database/seed.ts` (paused demo schedules)
- `packages/shared/router-stub.ts` (schedules type stubs)

> **Status: Phase 6.3 COMPLETE.** TTL policy is final, migration is verified, every Phase-6.x endpoint has at least one E2E test, and the platform now satisfies PRD acceptance criterion A9 (scheduled execution). The full set of "obvious next things" from Phase 6 are done.

---

## ✅ Phase 6.4: Discovery + billing + Docker + OTA + alerts

Sequential continuation. Closes the five "next useful" items from end-of-Phase-6.3.

### 6.4A: Screen auto-discovery (PRD §6.7)
| Component | File | Details |
|-----------|------|---------|
| **MQTT handler** | `apps/api/src/mqtt.ts` | `chromacommand/store/{id}/screens/discover` → upsert into `screens` table by MAC, derive stable id, register-ack back via `screens/register` |
| **State broadcast** | `apps/api/src/mqtt.ts` | `screen_status` + `screen_discovered` WS events for live dashboard updates |

### 6.4B: Sponsor billing
| Component | File | Details |
|-----------|------|---------|
| **`sponsor_activations` table** | `packages/database/schema.ts` + migration | sponsor name, preset id, scope/target, started/ended/duration, affected stores, rate per impression cents |
| **Auto-activation hook** | `apps/api/src/routers/sync.ts` | `sync.transform` detects sponsor presets via name regex (mtn/fnb/vodacom/...). Closes prior open activation, opens new one |
| **`sponsor.listActivations`** | `apps/api/src/routers/sponsor.ts` | Date-range filtered list, computes durationSeconds + ongoing flag |
| **`sponsor.invoice`** | `apps/api/src/routers/sponsor.ts` | Generates invoice line items: joins sensor_telemetry impressions × per-activation window × ratePerImpressionCents → totals in cents + ZAR |

### 6.4C: Edge-gateway Docker + provisioning
| Component | File | Details |
|-----------|------|---------|
| **Dockerfile** | `docker/Dockerfile.edge-gateway` | node:20-bookworm-slim, builds sqlite3 native, runs as `node` user uid 1000, healthcheck via local /health, volumes `/data` + `/etc/chromacommand` |
| **provision.sh** | `apps/edge-gateway/provision.sh` | Cloud-init / curl-bash one-liner: gens Ed25519 keypair, claims with 8-char code, fetches per-device cert, writes /etc/chromacommand/edge.env, installs systemd unit, opens UFW for 5000/tcp + 5353/udp, sets up cron-based cert auto-renewal at -30d |
| **Server-side `/provision/*`** | `apps/api/src/provisioning.ts` | `POST /provision/issue` (admin-keyed, mints 8-char code), `POST /provision/claim` (single-use code → cert + broker URL), `POST /provision/renew` (mTLS-authed, reissues cert) |

### 6.4D: OTA firmware updates (PRD §11.3, §15.3 A14)
| Component | File | Details |
|-----------|------|---------|
| **Schema** | `packages/database/schema.ts` + migration | `firmware_releases` (deviceClass, semver version, signed CDN URL, SHA-256, size, notes), `firmware_deployments` (release × scope × target with success/failure tally → status pending/success/failed/partial) |
| **Firmware router** | `apps/api/src/routers/firmware.ts` | `listReleases`, `createRelease` (admin/tech only, validates semver + SHA-256 hex), `deploy` (scope-checked, fan-out MQTT publish to `firmware/install`), `reportResult`, `listDeployments` |
| **Edge gateway** | `apps/edge-gateway/gateway.js` | Subscribes to `firmware/install`, fans out to local devices via WS as `firmware_install` event; collects `fw_ack` from devices and forwards each as `firmware/state` MQTT publish to cloud |
| **API ack ingest** | `apps/api/src/mqtt.ts` | Subscribes to `firmware/state`, increments success/failure counters in `firmware_deployments`, broadcasts `firmware_state` WS event |

### 6.4E: R638 compliance alerting + general alert engine
| Component | File | Details |
|-----------|------|---------|
| **Schema** | `packages/database/schema.ts` + migration | `alert_rules` (metric, comparator, threshold, sustainedMinutes, scope, severity, webhookUrl, cooldownMinutes), `alert_events` (rule × store × observed value × fired/resolved timestamps) |
| **Engine** | `apps/api/src/alerts-engine.ts` | 60s tick reads active rules, pulls last `sustainedMinutes` of telemetry, fires when **every** sample violates the comparator (with cooldown gating), auto-resolves when **none** violate, posts Slack-format JSON to webhookUrl |
| **Alerts router** | `apps/api/src/routers/alerts.ts` | `listRules`, `createRule` (admin/RM), `updateRule`, `deleteRule` (admin), `evalNow` (force a tick — admin/tech), `summary` (severity counts last N hours), `recentEvents` |
| **Boot wiring** | `apps/api/src/index.ts` | `startAlertsEngine()` non-fatal; `DISABLE_ALERTS=1` opts out |
| **Default rule** | `packages/database/seed.ts` | Active critical rule: temperature > 5°C sustained 10m → R638 compliance breach. Plus inactive footfall-drop warning template |
| **Alerts page** | `apps/dashboard/app/alerts/page.tsx` | Severity summary cards, create-rule form (metric/comparator/threshold/sustained/severity/cooldown/webhook), active rules with pause/delete, last-50 events feed, "Eval now" debug button |

### Files Added (8)
- `apps/api/src/provisioning.ts`
- `apps/api/src/alerts-engine.ts`
- `apps/api/src/routers/firmware.ts`
- `apps/api/src/routers/alerts.ts`
- `apps/dashboard/app/firmware/page.tsx`
- `apps/dashboard/app/alerts/page.tsx`
- `apps/edge-gateway/provision.sh`
- `docker/Dockerfile.edge-gateway`

### Files Modified
- `apps/api/src/index.ts` (alerts engine + provisioning routes init)
- `apps/api/src/mqtt.ts` (screen discovery + firmware ack handlers + new subscription)
- `apps/api/src/routers/_app.ts` (mount firmware + alerts routers)
- `apps/api/src/routers/sync.ts` (sponsor billing hook)
- `apps/api/src/routers/sponsor.ts` (listActivations + invoice)
- `apps/edge-gateway/gateway.js` (firmware install handler + fw_ack forwarding)
- `apps/dashboard/app/components/Sidebar.tsx` (Firmware + Alerts nav)
- `packages/database/schema.ts` (5 new tables)
- `packages/database/drizzle/0000_init.sql` (5 new tables)
- `packages/database/seed.ts` (R638 default rule + footfall template)
- `packages/shared/router-stub.ts` (firmware + alerts type stubs)
- `.env.example` (PROVISION_ADMIN_KEY, PROVISION_BROKER_URL, DISABLE_*)

### Schema delta this phase
+5 tables: `sponsor_activations`, `firmware_releases`, `firmware_deployments`, `alert_rules`, `alert_events`. Total schema: **23 tables**.

> **Status: Phase 6.4 COMPLETE.** Every "next useful" item from the end of Phase 6.3 shipped: screens self-register, sponsor TakeOvers auto-bill, the gateway is Docker-deployable with single-command provisioning, ESP32/Pi devices accept OTA firmware over MQTT with rollout tracking, and R638 fridge breaches trigger Slack webhooks within 60s of sustained violation.
