# Graph Report - chromacommand-platform  (2026-08-22)

## Corpus Check
- 127 files · ~72,193 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1099 nodes · 1823 edges · 80 communities (63 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb7573b0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- schema.ts
- devDependencies
- scheduler.ts
- CODER.md — INFX Chroma Command Platform
- dependencies
- dependencies
- gateway.js
- tasks
- ui/index.ts
- trpc
- src/auth.ts
- audio.js
- package.json
- player.js
- compilerOptions
- database/package.json
- trpc.tsx
- MatrixView.tsx
- control/page.tsx
- ChromaCommand API Documentation
- router-stub.ts
- ChromaCommand Operational Runbook
- edge-gateway/package.json
- compilerOptions
- DESIGN.md
- ChromaCommand Platform
- Case Study: Papa Pasta Sandton — One-Button MTN TakeOver
- screen-player/package.json
- ChromaCommand Platform — Implementation Progress
- schemas.ts
- trpc-routers.ts
- compilerOptions
- 5. Critical Gaps & Technical Debt (Condensed from 6 Agents)
- PRD: ChromaCommand Platform — RGB + Menu Streaming IoT
- Spinner
- audio-player/package.json
- compilerOptions
- shared/src/index.ts
- ✅ Phase 6.3: TTL lock-in + migration audit + endpoint tests + scheduled transitions
- shared/package.json
- ✅ Phase 6.4: Discovery + billing + Docker + OTA + alerts
- ✅ Phase 6: Auth/RBAC + Real MQTT + Telemetry — COMPLETE (2026-04-25)
- 🔴 Critical — Security / Production Blockers
- 6. Recommended Next Phase: "Production Hardening & Go-to-Market"
- ✅ Phase 7: Master Control — Hierarchy + Working Device Pipeline (2026-08-22)
- devDependencies
- dashboard/package.json
- ✅ Phase 5: Live WebSocket + Sponsor Dashboard + Auto-Seed + E2E Tests — COMPLETE
- ✅ Phase 6.2: Edge bridge + refresh tokens + migrations + rollback UI
- ✅ Phase 6.5: Materialized views + nightly maintenance + UX polish
- ✅ Phase 6.1: Auth-aware tests + WS auth + login rate-limit + mTLS support
- 7. Acceptance Criteria
- e2e.test.ts
- commands/page.tsx
- Running the Platform
- ChromaCommand Security Policy
- landing/page.tsx
- next.config.js
- 4. Current Status
- AGENTS.md
- next-env.d.ts
- tailwind.config.ts
- provision.sh
- @chromacommand/shared
- clsx
- firebase
- framer-motion
- lucide-react
- postcss
- react
- react-dom
- tailwindcss
- @tanstack/react-query

## God Nodes (most connected - your core abstractions)
1. `db` - 29 edges
2. `broadcast()` - 24 edges
3. `ChromaCommand Platform — Implementation Progress` - 21 edges
4. `appLog()` - 20 edges
5. `cn()` - 20 edges
6. `router` - 19 edges
7. `trpc` - 18 edges
8. `protectedProcedure` - 17 edges
9. `scopeFromRequest()` - 17 edges
10. `ChromaCommand API Documentation` - 17 edges

## Surprising Connections (you probably didn't know these)
- `evaluateRule()` --calls--> `broadcast()`  [EXTRACTED]
  apps/api/src/alerts-engine.ts → apps/api/src/live/index.ts
- `dispatchToStores()` --calls--> `appLog()`  [EXTRACTED]
  apps/api/src/dispatch.ts → apps/api/src/logger.ts
- `main()` --indirect_call--> `createContext()`  [INFERRED]
  apps/api/src/index.ts → apps/api/src/trpc.ts
- `applySchedule()` --calls--> `broadcast()`  [EXTRACTED]
  apps/api/src/scheduler.ts → apps/api/src/live/index.ts
- `authRouter` --calls--> `appLog()`  [EXTRACTED]
  apps/api/src/routers/auth.ts → apps/api/src/logger.ts

## Import Cycles
- None detected.

## Communities (80 total, 17 thin omitted)

### Community 0 - "schema.ts"
Cohesion: 0.06
Nodes (89): protectedProcedure, requireRole(), requireScope(), router, DispatchSpec, dispatchToStores(), newCommandId(), recordAck() (+81 more)

### Community 1 - "devDependencies"
Cohesion: 0.07
Nodes (27): devDependencies, tsx, @types/jsonwebtoken, @types/node, @types/node-cron, @types/nodemailer, typescript, vitest (+19 more)

### Community 2 - "scheduler.ts"
Cohesion: 0.08
Nodes (44): affectedStoreIds(), COMPARATORS, evalAll(), evaluateRule(), getMailer(), postWebhook(), sendEmail(), slackPayload() (+36 more)

### Community 3 - "CODER.md — INFX Chroma Command Platform"
Cohesion: 0.05
Nodes (43): 0. The Vision, 10. Current Status, 1.1 Scope Hierarchy, 1.2 LED Zone Groups (Per Store), 1.3 Section-Level Mapping (Critical Requirement), 1.4 Colour Modes, 1.5 Scene System, 1.6 RGB Set API (+35 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @chromacommand/database, dotenv, drizzle-orm, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet (+29 more)

### Community 5 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, autoprefixer, next, recharts, tailwind-merge, @trpc/client, @trpc/react-query, @trpc/server (+7 more)

### Community 6 - "gateway.js"
Cohesion: 0.11
Nodes (41): ackUpstream(), announceGatewayPresence(), app, cloud, cloudOptions, CONFIG, connectLocal(), db (+33 more)

### Community 7 - "tasks"
Cohesion: 0.06
Nodes (31): AppShell(), AuthGate(), getCookie(), PUBLIC_ROUTES, navItems, Sidebar(), metadata, ^build (+23 more)

### Community 8 - "ui/index.ts"
Cohesion: 0.14
Nodes (15): Badge(), BadgeProps, ButtonProps, CardProps, InputProps, SelectProps, TextArea(), TextAreaProps (+7 more)

### Community 9 - "trpc"
Cohesion: 0.13
Nodes (13): RecentSyncs(), Button(), Input(), Section(), SectionHeader(), ArtifactRow, ArtifactStatus, DEVICE_CLASSES (+5 more)

### Community 10 - "src/auth.ts"
Cohesion: 0.13
Nodes (23): AuthUser, Ctx, JWT_SECRET, loginWithEmail(), publicProcedure, REFRESH_TTL_DAYS, REFRESH_TTL_SECONDS, Role (+15 more)

### Community 11 - "audio.js"
Cohesion: 0.19
Nodes (23): announceQueue, CONFIG, connect(), effectiveVolume(), enqueueAnnouncement(), { execFile, spawn }, execFileAsync, fadeTo() (+15 more)

### Community 12 - "package.json"
Cohesion: 0.08
Nodes (24): description, devDependencies, turbo, typescript, engines, node, turbo, typescript (+16 more)

### Community 13 - "player.js"
Cohesion: 0.16
Nodes (22): advance(), { app, BrowserWindow }, cachePath(), clearOverlay(), CONFIG, connect(), fetchUrl(), fs (+14 more)

### Community 14 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+20 more)

### Community 15 - "database/package.json"
Cohesion: 0.07
Nodes (28): drizzle-kit, dependencies, dotenv, drizzle-orm, pg, devDependencies, drizzle-kit, tsx (+20 more)

### Community 16 - "trpc.tsx"
Cohesion: 0.16
Nodes (10): LogoutButton(), handle(), Card(), LiveMessage, getBaseUrl(), getCookie(), getToken(), setToken() (+2 more)

### Community 17 - "MatrixView.tsx"
Cohesion: 0.15
Nodes (9): DemoModeBanner(), demoStores, MatrixView(), OnboardingTour(), steps, StoreCard(), StoreCardProps, useLiveSocket() (+1 more)

### Community 18 - "control/page.tsx"
Cohesion: 0.11
Nodes (7): AUDIO_ZONE_TYPES, mutedNow(), RGB_MODES, ScopeLevel, Selection, TABS, ZoneTransport()

### Community 19 - "ChromaCommand API Documentation"
Cohesion: 0.11
Nodes (18): alerts, analytics, audio, auth, Auth Requirements Key, ChromaCommand API Documentation, content, Error Codes (+10 more)

### Community 20 - "router-stub.ts"
Cohesion: 0.11
Nodes (18): alertsRouter, analyticsRouter, anyInput, audioRouter, authRouter, commandsRouter, contentRouter, firmwareRouter (+10 more)

### Community 21 - "ChromaCommand Operational Runbook"
Cohesion: 0.08
Nodes (24): 1. MQTT Broker Connectivity, 2. Edge Gateway Offline Detection, 3. Screen Player Content Rendering Failures, 4. Audio Player MPD Connection Issues, 5. Escalation Playbook: Restart vs. Replace, 6. Technician Field Guide, 7. Contacts & Escalation, ChromaCommand Operational Runbook (+16 more)

### Community 22 - "edge-gateway/package.json"
Cohesion: 0.12
Nodes (15): dependencies, express, mqtt, sqlite3, ws, mqtt, ws, name (+7 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, declaration, esModuleInterop, module, moduleResolution, noImplicitAny, noUncheckedIndexedAccess (+13 more)

### Community 24 - "DESIGN.md"
Cohesion: 0.13
Nodes (14): Badges, Buttons, Cards, Colors, Components, Do's and Don'ts, Elevation & Depth, Inputs (+6 more)

### Community 25 - "ChromaCommand Platform"
Cohesion: 0.13
Nodes (15): 1. Local dev with Docker Compose, 2. Without Docker (manual), Architecture (one-page), ChromaCommand Platform, CI, Control hierarchy & scoping, Deploying to production, Device bus (+7 more)

### Community 26 - "Case Study: Papa Pasta Sandton — One-Button MTN TakeOver"
Cohesion: 0.15
Nodes (12): Audio, Case Study: Papa Pasta Sandton — One-Button MTN TakeOver, Deployment, LED Zones, Next Steps, Overview, Results, Screen Content (+4 more)

### Community 27 - "screen-player/package.json"
Cohesion: 0.15
Nodes (12): electron, dependencies, mqtt, devDependencies, electron, mqtt, main, name (+4 more)

### Community 28 - "ChromaCommand Platform — Implementation Progress"
Cohesion: 0.15
Nodes (13): ChromaCommand Platform — Implementation Progress, File Structure (59 files across monorepo), Key Technical Decisions, Last Updated: 2026-04-25 (12:08 AM SAST), Next Steps (Phase 6 — Future), ✅ Phase 0: Foundation — COMPLETE, ✅ Phase 1: RGB + Edge + Screen + Audio Firmware — COMPLETE, ✅ Phase 2: Dashboard UI — COMPLETE (+5 more)

### Community 29 - "schemas.ts"
Cohesion: 0.18
Nodes (10): AudioZoneType, ColourMode, ContentAsset, ContentAssetType, RgbColour, RgbColourType, RgbSetCommand, RgbSetCommandType (+2 more)

### Community 30 - "trpc-routers.ts"
Cohesion: 0.18
Nodes (10): SyncTransformCommand, AppRouter, audioRouter, contentRouter, publicProcedure, rgbRouter, router, storesRouter (+2 more)

### Community 31 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, module, moduleResolution, outDir, skipLibCheck (+8 more)

### Community 32 - "5. Critical Gaps & Technical Debt (Condensed from 6 Agents)"
Cohesion: 0.18
Nodes (11): #10: Dashboard Desktop-Only (`Psylocke`), #11: No Onboarding (`Psylocke`, `Strategy`), #12: Custom Toggle Switches Inaccessible (`Psylocke`), 5. Critical Gaps & Technical Debt (Condensed from 6 Agents), #7: K8s Plaintext Secret Committed (`Colossus`, `Wolverine`), #8: Dockerfiles Shipping Dev Dependencies (`Colossus`), #9: Postgres — No Backup (`Colossus`), 🔴 Critical — Infrastructure / Secrets (+3 more)

### Community 33 - "PRD: ChromaCommand Platform — RGB + Menu Streaming IoT"
Cohesion: 0.18
Nodes (11): 1. Executive Summary, 2. Tech Stack, 3.1 Monorepo Structure, 3.2 Data Flow, 3.3 Auth Flow (Current), 3.4 External Integrations, 3. Architecture, 8. Agent Assignment (+3 more)

### Community 34 - "Spinner"
Cohesion: 0.24
Nodes (6): Select(), Spinner(), SpinnerProps, FleetPage(), timeAgo(), TYPE_LABELS

### Community 35 - "audio-player/package.json"
Cohesion: 0.20
Nodes (9): dependencies, mqtt, mqtt, main, name, private, scripts, start (+1 more)

### Community 36 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, resolveJsonModule, skipLibCheck (+8 more)

### Community 37 - "shared/src/index.ts"
Cohesion: 0.31
Nodes (5): AppRouter, createCallerFactory, publicProcedure, router, t

### Community 38 - "✅ Phase 6.3: TTL lock-in + migration audit + endpoint tests + scheduled transitions"
Cohesion: 0.29
Nodes (7): 6.3A: Refresh-token TTL — Policy B locked in, 6.3B: Migration drift audit, 6.3C: Tests for new endpoints, 6.3D: Scheduled RGB transitions (PRD acceptance criterion A9), Files Added, Files Modified, ✅ Phase 6.3: TTL lock-in + migration audit + endpoint tests + scheduled transitions

### Community 39 - "shared/package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod, devDependencies, typescript, typescript, zod, main, name (+3 more)

### Community 40 - "✅ Phase 6.4: Discovery + billing + Docker + OTA + alerts"
Cohesion: 0.22
Nodes (9): 6.4A: Screen auto-discovery (PRD §6.7), 6.4B: Sponsor billing, 6.4C: Edge-gateway Docker + provisioning, 6.4D: OTA firmware updates (PRD §11.3, §15.3 A14), 6.4E: R638 compliance alerting + general alert engine, Files Added (8), Files Modified, ✅ Phase 6.4: Discovery + billing + Docker + OTA + alerts (+1 more)

### Community 41 - "✅ Phase 6: Auth/RBAC + Real MQTT + Telemetry — COMPLETE (2026-04-25)"
Cohesion: 0.22
Nodes (9): 6A: Auth + RBAC, 6B: Real MQTT Dispatch, 6C: Sensor Telemetry, 6D: Observability, 6E: PRD v1.2, Files Added (10), Files Modified, Migration Note (+1 more)

### Community 42 - "🔴 Critical — Security / Production Blockers"
Cohesion: 0.29
Nodes (7): #1: Authentication Completely Bypassed (`Wolverine`, `Psylocke`, `Forge`, `Colossus`), #2: Dev-Mode Password Bypass (`Wolverine`, `Forge`), #3: Hardcoded JWT Secret Fallback (`Wolverine`, `Forge`, `Colossus`), #4: Dashboard Token in `localStorage` (`Wolverine`, `Forge`), #5: No Security Headers (`Wolverine`, `Forge`, `Colossus`), #6: Plaintext Spotify Tokens (`Wolverine`), 🔴 Critical — Security / Production Blockers

### Community 43 - "6. Recommended Next Phase: "Production Hardening & Go-to-Market""
Cohesion: 0.29
Nodes (7): 6. Recommended Next Phase: "Production Hardening & Go-to-Market", Immediate Quick Wins (Day 1), Phase Goal, Sprint 1 (Days 1–7): Security Lockdown, Sprint 2 (Week 2): Auth UX & Observability, Sprint 3 (Week 3–4): Firmware & Edge Production Readiness, Sprint 4 (Month 2): GTM & Documentation

### Community 44 - "✅ Phase 7: Master Control — Hierarchy + Working Device Pipeline (2026-08-22)"
Cohesion: 0.29
Nodes (7): 7A: Geographic hierarchy + scope engine, 7B: Command ledger + acks, 7C: Edge gateway v2 — local MQTT device bus, 7D: Firmware v2 (all three targets), 7E: Dashboard master console, ✅ Phase 7: Master Control — Hierarchy + Working Device Pipeline (2026-08-22), Verification

### Community 45 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, @types/node, @types/react, typescript, @types/node, typescript (+3 more)

### Community 46 - "dashboard/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, typecheck (+1 more)

### Community 47 - "✅ Phase 5: Live WebSocket + Sponsor Dashboard + Auto-Seed + E2E Tests — COMPLETE"
Cohesion: 0.33
Nodes (6): 5A: WebSocket Live Updates, 5B: Auto-Seed on Docker Compose Up, 5C: Sponsor Dashboard (Read-only Analytics), 5D: End-to-End Test Suite, Critical Fixes, ✅ Phase 5: Live WebSocket + Sponsor Dashboard + Auto-Seed + E2E Tests — COMPLETE

### Community 48 - "✅ Phase 6.2: Edge bridge + refresh tokens + migrations + rollback UI"
Cohesion: 0.25
Nodes (8): 6.2A: Edge gateway aligned with v1.2 schema, 6.2B: Refresh token rotation, 6.2C: Drizzle migrations checked in, 6.2D: One-Button Sync rollback UI, Files Added, Files Modified, Open Decision (waiting on Ricardo), ✅ Phase 6.2: Edge bridge + refresh tokens + migrations + rollback UI

### Community 49 - "✅ Phase 6.5: Materialized views + nightly maintenance + UX polish"
Cohesion: 0.25
Nodes (8): 6.5A: Pre-aggregated telemetry views, 6.5B: Nightly maintenance cron, 6.5C: Logout UX, 6.5D: Updated docker-compose for full local stack, 6.5E: README rewrite, Files Added, Files Modified, ✅ Phase 6.5: Materialized views + nightly maintenance + UX polish

### Community 50 - "✅ Phase 6.1: Auth-aware tests + WS auth + login rate-limit + mTLS support"
Cohesion: 0.50
Nodes (4): Files Added, Files Modified, ✅ Phase 6.1: Auth-aware tests + WS auth + login rate-limit + mTLS support, Test Coverage Summary

### Community 51 - "7. Acceptance Criteria"
Cohesion: 0.40
Nodes (5): 7. Acceptance Criteria, A. Security Must Pass Pre-Production Gate, B. Infrastructure Must Be Production-Ready, C. Dashboard Must Be Usable & Accessible, D. Documentation Must Be Complete

### Community 53 - "commands/page.tsx"
Cohesion: 0.67
Nodes (3): CommandsPage(), STATUS_STYLES, timeAgo()

### Community 54 - "Running the Platform"
Cohesion: 0.50
Nodes (4): Option 1: Docker Compose (Recommended — Auto-Seed), Option 2: Local Dev (requires Node 20+ and Postgres), Running Tests, Running the Platform

### Community 55 - "ChromaCommand Security Policy"
Cohesion: 0.50
Nodes (3): ChromaCommand Security Policy, Known Security Issues & Remediation Status, Reporting a Vulnerability

### Community 60 - "4. Current Status"
Cohesion: 0.67
Nodes (3): 4.1 What Works (v1.2 — ~85–90% implemented), 4.2 What Is Broken / Missing, 4. Current Status

## Knowledge Gaps
- **557 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+552 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppRouter` connect `shared/src/index.ts` to `trpc.tsx`, `router-stub.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `ChromaCommand Platform — Implementation Progress` connect `ChromaCommand Platform — Implementation Progress` to `✅ Phase 6.3: TTL lock-in + migration audit + endpoint tests + scheduled transitions`, `✅ Phase 6.4: Discovery + billing + Docker + OTA + alerts`, `✅ Phase 6: Auth/RBAC + Real MQTT + Telemetry — COMPLETE (2026-04-25)`, `✅ Phase 7: Master Control — Hierarchy + Working Device Pipeline (2026-08-22)`, `✅ Phase 5: Live WebSocket + Sponsor Dashboard + Auto-Seed + E2E Tests — COMPLETE`, `✅ Phase 6.2: Edge bridge + refresh tokens + migrations + rollback UI`, `✅ Phase 6.5: Materialized views + nightly maintenance + UX polish`, `✅ Phase 6.1: Auth-aware tests + WS auth + login rate-limit + mTLS support`, `Running the Platform`, `README.md`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _557 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05664830841856806 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `scheduler.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07686932215234102 - nodes in this community are weakly interconnected._
- **Should `CODER.md — INFX Chroma Command Platform` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._