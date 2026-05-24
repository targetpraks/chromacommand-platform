---
prd: "ChromaCommand Platform — RGB + Menu Streaming IoT"
status: draft
date: "2026-05-24"
version: "1.2-draft"
agents: [Forge, Beast, Psylocke, Wolverine, Strategy, Colossus]
overall_health_score: 5.5
---

# PRD: ChromaCommand Platform — RGB + Menu Streaming IoT

> **Repository:** `targetpraks/chromacommand-platform`  
> **Project:** Full-stack IoT control platform for unified in-store RGB lighting, digital menu screens, audio zones, sensor telemetry, and sponsor "TakeOver" campaigns.

---

## 1. Executive Summary

ChromaCommand is **the most mature and strategically valuable repository in the portfolio** — an enterprise-grade IoT control platform that unifies RGB lighting, digital menu screens, and in-store audio with real-time "One-Button Sync." It is also the most dangerous codebase to deploy publicly: **authentication is entirely bypassed**, a **hardcoded JWT secret fallback** is committed to source and K8s manifests, and **dashboard tokens live in `localStorage`**.

| Dimension | Score | Key Asset |
|-----------|-------|-----------|
| **Technical / Code Quality** | 5.5 / 10 | Excellent architecture (Turborepo, Fastify, tRPC, Drizzle); 46 `any` types, 84 `console.*` calls, minimal tests |
| **Documentation** | 4.5 / 5 | Exceptional PRD v1.2 (1,441 lines), CODER.md, PROGRESS.md, exemplary README with ASCII architecture diagram |
| **UX / Customer-Facing** | 5.1 / 10 | Powerful 12-section dashboard; auth bypassed, desktop-only, no onboarding, custom toggles break accessibility |
| **Security** | 4.0 / 10 | Dev-mode auth bypass, hardcoded JWT secret, plaintext K8s secret, `localStorage` tokens, no helmet, anonymous MQTT |
| **Business / GTM** | 55% readiness | Product 85% built, sales/ops/safety 25% — no landing page, pricing, or case studies |
| **Infrastructure** | 5.0 / 10 | Solid Docker/K8s foundations; critical secrets management and production-readiness gaps |

**Aggregate Health: 5.5 / 10** — An advanced product that cannot leave the garage without security restoration and sales packaging.

### The Stakes
ChromaCommand could generate **R500K–R2M ARR within 12 months** if sold to SA QSR chains or extended to international markets. Every day it remains un-sold, competitors (Broadsign, Signagelive, brand-specific POS integrators) widen their lead. The **dev-mode auth bypass** means a single public deployment is a data breach.

---

## 2. Tech Stack

```yaml
Monorepo:        Turborepo (turbo.json) with pnpm workspaces

Frontend (Dashboard):
  Framework:      Next.js 14.2 (App Router)
  React:          18.3
  Styling:        Tailwind CSS v3
  Animation:      Framer Motion
  Data:           tRPC 11.0 (client), React Query, WebSocket live updates
  Auth:           JWT Bearer in localStorage (cc_jwt)
  Charts:         Recharts, Firebase (analytics)

Backend (API):
  Framework:      Fastify 4.26 + @fastify/websocket
  RPC:            tRPC 11.0 with Zod validation
  ORM:            Drizzle ORM 0.30 + drizzle-kit
  Auth:           Custom JWT (jsonwebtoken ^9.0.2) + refresh-token rotation (JTI-based)
  Rate Limit:     In-memory Map token bucket (not wired to routes; not Redis-backed)
  MQTT:           Mosquitto (eclipse-mosquitto:2)
  Telemetry:      Sensor telemetry ingestion via MQTT, alert engine (60s interval)

Database:
  Primary:        PostgreSQL 16
  Cache:          Redis 7 (StatefulSet)
  Edge Cache:     SQLite (apps/edge-gateway)
  ORM:            Drizzle ORM with migrations

Edge Gateway:
  Runtime:        Node.js 20 (bookworm-slim)
  Protocols:     MQTT bridge, WebSocket local broadcast, ESP-NOW mesh
  Features:       Command deduplication, sensor buffering, offline resilience, mTLS

Firmware:
  Target:         ESP32-S3 (RGB control), Raspberry Pi 5 (screen player, audio node)
  OTA:            Role-gated firmware update with rollback support
```

**Notes on version drift:** Dashboard uses Next.js 14 + React 18 while newer repos in portfolio use Next.js 16 + React 19. Consider upgrading for consistency.

---

## 3. Architecture

### 3.1 Monorepo Structure
```
chromacommand-platform/
  turbo.json                   # Pipeline: lint, typecheck, build, test
  apps/
    api/
      src/
        index.ts               # Fastify bootstrap: CORS, websocket, tRPC, /metrics, /readyz
                               # index.ts:75: host "0.0.0.0" on plain HTTP (relies on ingress for TLS)
        auth.ts                # JWT generate/verify + refresh-token logic
                               # auth.ts:24: JWT_SECRET fallback `dev-secret-change-me`
                               # auth.ts:75-87: loginWithEmail() accepts ANY password for seeded users
        routers/
          auth.ts              # tRPC auth router (login, logout, refresh, me)
          sponsor.ts           # Sponsor analytics (read-only for MTN/FNB)
                               # sponsor.ts:34: storeStats: any[]
                               # sponsor.ts:102: series: any[]
          stores.ts            # Store CRUD, zone management
                               # stores/[id].tsx:76: zone: any
          sync.ts              # One-Button Sync / TakeOver mutations
          schedules.ts         # Cron-based schedule runner (conflict detection)
          alerts.ts            # Alert engine (evaluation, notifications)
          spotify.ts           # Spotify OAuth callback + token storage
        rate-limit.ts           # In-memory Map token bucket (NOT wired to routes; NOT Redis)
        provisioning.ts         # Edge device provisioning (mTLS, device certs)
                               # provisioning.ts:70: /provision/issue gated by single PROVISION_ADMIN_KEY
                               # provisioning.ts:73: req.body as any (no Zod validation)
                               # provisioning.ts:127-132: /provision/renew trusts x-store-id header
        mqtt.ts                 # Singleton MQTT client with auto-reconnect (any types used)
    dashboard/
      app/
        lib/trpc.tsx           # tRPC client config
                               # trpc.tsx:9: Token stored in localStorage (cc_jwt)
        page.tsx               # Root: redirects to /matrix
        matrix/page.tsx        # MatrixView: demo stores grid (PP-A01, PP-A02, PP-J01)
        stores/page.tsx        # Store list with demo data
        stores/[id]/page.tsx   # Store detail (zone map)
                               # stores/[id]/page.tsx:76: (store.zones || []).map((zone: any, i: number)
        content/page.tsx       # Digital menu content manager
        audio/page.tsx         # Audio / MPD control
        spotify/page.tsx       # Spotify OAuth + playlists
        sync/page.tsx           # One-Button Sync / TakeOver UI
        schedules/page.tsx     # Content scheduling
        alerts/page.tsx        # Alert creation + "Eval Now"
        analytics/page.tsx     # Store performance dashboards
        firmware/page.tsx      # OTA firmware manager
                               # firmware/page.tsx:47: catch (ex: any)
        settings/page.tsx      # Org name, timezone, role list
        login/page.tsx         # Stub: immediately redirects to / (no real login)
        components/AuthGate.tsx
                               # AuthGate.tsx: "currently bypassed for development" — returns children unconditionally
    edge-gateway/
      gateway.js               # MQTT-to-mesh bridge, SQLite cache, WebSocket local broadcast, healthcheck
      provision.sh             # Edge device first-boot provisioning
                               # provision.sh:6: curl | sudo bash (no checksum verification)
  packages/
    database/
      src/schema.ts            # Drizzle ORM schema (users, stores, zones, content, schedules, alerts, sensor_telemetry, activity_log, spotifyAccounts)
      seed.ts                  # Demo users + stores
                               # seed.ts:147: demo user with real name + email (PII in seed)
  docker/
    Dockerfile.api             # Multi-stage build (dev deps included in final image)
    Dockerfile.dashboard       # Multi-stage build; next.config.js: ignores build errors during build
    Dockerfile.edge-gateway    # Best in repo: build deps stage, drops to USER node, HEALTHCHECK present
    mosquitto.conf             # allow_anonymous true (dev only)
  docker-compose.yml           # Full stack: Postgres + Redis + Mosquitto + API + Dashboard + Edge + Seed
  k8s/
    namespace.yaml
    secrets.yaml               # PLAINTEXT jwt-secret: "dev-secret-change-me"
    api-deployment.yaml        # imagePullPolicy: Never, no resource limits/probes
    dashboard-deployment.yaml  # imagePullPolicy: Never, no resource limits/probes
    edge-gateway-deployment.yaml
    mqtt-deployment.yaml       # allow_anonymous true
    postgres-statefulset.yaml  # 1Gi PVC, no backup CronJob
    redis-statefulset.yaml     # 500Mi PVC
    ingress.yaml             # ssl-redirect: "false", local hostnames only
  .github/workflows/ci.yml   # typecheck → build → test (Vitest with Postgres service)

```

### 3.2 Data Flow
```
Dashboard (Next.js 14) ──tRPC─→ Fastify API ──Drizzle─→ PostgreSQL
       │                           │
       ├─WebSocket /live/ws───────┤
       │                           ├──MQTT──→ Mosquitto──→ Edge Gateway──→ ESP32-S3 / RPi5
       │                           │
       └──Bearer: localStorage─────┴───────┬──Redis (cache/session)
                                           └──Sensor Telemetry──→ alert engine (60s)
```

### 3.3 Auth Flow (Current)
```
Login page (stub) ──→ AuthGate.tsx (bypassed) ──→ Dashboard
  │
  └── If auth were enforced:
        loginWithEmail() accepts ANY password for seeded users
        JWT generated with "dev-secret-change-me" if env var missing
        Token stored in localStorage (dashboard)
        Refresh token rotation with JTI-based reuse detection (correctly implemented)
```

### 3.4 External Integrations
- **Zoho/HubSpot:** PRD-defined but not implemented
- **Spotify:** OAuth2 callback implemented; tokens stored in `spotifyAccounts` table (plaintext)
- **INFX Media:** Value chain not explicitly marketed
- **POS Systems:** No SAP/Oracle integration yet
- **Hardware:** ESP32-S3 (RGB), Raspberry Pi 5 (screen/audio), Lenovo ThinkCentre Tiny (edge gateway)

---

## 4. Current Status

### 4.1 What Works (v1.2 — ~85–90% implemented)
| Feature | Status |
|---------|--------|
| RGB Store Controller (LED zones, presets, scheduling, offline resilience) | ✅ |
| Digital Menu / Content Stream (content model, diff sync, screen auto-discovery, offline cache) | ✅ |
| Audio / Music Player (per-zone audio, MPD control, TTS, music presets) | ✅ |
| Colour Matrix Hub Dashboard (Matrix View, Store Detail, Content Manager, Analytics, Audio, Settings) | ✅ |
| One-Button Sync / TakeOver (sync.transform mutation with rollback UI) | ✅ |
| Auth / RBAC (JWT + refresh rotation, role-based access, scope-based filtering) | ⚠️ Bypassed |
| Real MQTT dispatch (singleton client, auto-reconnect, QoS, mTLS paths) | ✅ |
| Sensor Telemetry (sensor_telemetry table, MQTT ingestion, tRPC endpoints) | ✅ |
| WebSocket live updates (/live/ws with auth + scope filtering, dashboard hook) | ✅ |
| Prometheus metrics (/metrics endpoint) | ✅ |
| Sponsor Dashboard (read-only analytics for MTN/FNB partners) | ✅ |
| Edge Gateway (SQLite cache, command dedup, sensor buffering, mTLS) | ✅ |
| E2E Tests (15 tests covering auth, RBAC, telemetry, load, WS) | ✅ |

### 4.2 What Is Broken / Missing
| Feature | Status |
|---------|--------|
| **Authentication enforcement** | ❌ **ALL BYPASSED** — `AuthGate` returns children unconditionally |
| **Login page** | ❌ Stub — immediately redirects to `/` |
| **JWT secret management** | ❌ Hardcoded fallback + plaintext in K8s + .env.example |
| **Security headers** | ❌ No CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| **Rate limiting productionized** | ❌ In-memory only; not wired to tRPC middleware |
| **MQTT production security** | ❌ `allow_anonymous true` / plain mqtt:// in dev |
| **Firmware OTA completeness** | ⚠️ Partial — OTA paths defined; implementation unclear |
| **PostgreSQL backup** | ❌ No pg_dump CronJob, no WAL archiving |
| **Prometheus scraping** | ❌ No K8s scraping annotations for /metrics |
| **Sales landing page** | ❌ None — README is developer-facing, not buyer-facing |
| **Pricing / ROI calculator** | ❌ Not implemented |
| **Multi-country expansion** | ❌ Deferred to Phase 7+ |
| **AI playlist curation** | ❌ Deferred |
| **Mobile companion app** | ❌ Deferred |

---

## 5. Critical Gaps & Technical Debt (Condensed from 6 Agents)

### 🔴 Critical — Security / Production Blockers

#### #1: Authentication Completely Bypassed (`Wolverine`, `Psylocke`, `Forge`, `Colossus`)
**File:** `apps/dashboard/app/components/AuthGate.tsx` (comment: "currently bypassed for development")  
**Finding:** `AuthGate` returns `{children}` unconditionally, bypassing JWT checks entirely.  
**Impact:** Anyone with the dashboard URL can monitor, control, or misconfigure all store lighting, audio, and digital menus. Anyone could trigger a "One-Button Sync" that changes every store simultaneously.  
**Fix:** Remove bypass immediately. Implement `loginWithEmail()` → `AuthGate` → `requireAuth()` → `requireRole()` chain. **Do not deploy publicly before this is fixed.**

#### #2: Dev-Mode Password Bypass (`Wolverine`, `Forge`)
**File:** `apps/api/src/auth.ts:75-87`  
**Finding:** `loginWithEmail()` accepts ANY password (`_password` parameter is unused) for all seeded users. No `NODE_ENV` guard or feature flag.  
**Impact:** If this route is reachable in production, anyone can authenticate as any seeded user (HQ admin, franchisee, technician) by providing only the email.  
**Fix:** Throw `ForbiddenError` when `NODE_ENV === 'production'` if `config.isDevAuth` is not explicitly enabled. Remove entirely if no longer needed.

#### #3: Hardcoded JWT Secret Fallback (`Wolverine`, `Forge`, `Colossus`)
**File:** `apps/api/src/auth.ts:24` — `JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me"`  
**Also in:** `k8s/secrets.yaml:8` — `jwt-secret: "dev-secret-change-me"`  
**Also in:** `.env.example:5` — `JWT_SECRET=dev-secret-change-me`  
**Impact:** Tokens become trivially forgeable by anyone who has seen the repo (i.e., the entire internet). An attacker with a forged token can impersonate any user, including `hq_admin`.  
**Fix:**
1. Remove fallback in `auth.ts` — fail-fast if `JWT_SECRET` is unset.
2. Delete `k8s/secrets.yaml` from git entirely. Use External Secrets Operator, Sealed Secrets, or HashiCorp Vault injection in production.
3. Replace `.env.example` value with `JWT_SECRET=REPLACE_ME` and add a startup check.
4. Rotate the JWT secret in the production environment immediately.
5. Invalidate all existing tokens by bumping JWT version or clearing refresh tokens.

#### #4: Dashboard Token in `localStorage` (`Wolverine`, `Forge`)
**File:** `apps/dashboard/app/lib/trpc.tsx:9` — `localStorage.setItem('cc_jwt', token)`  
**Impact:** Any XSS vulnerability (or malicious installed browser extension) can steal the access token, leading to full account takeover. Since the dashboard controls physical in-store devices, this is a **physical-world security risk.**  
**Fix:** Move token storage to `HttpOnly`, `Secure`, `SameSite=Strict` cookies served by the API. Dashboard should receive cookies automatically via `credentials: 'include'` in tRPC fetch config.

#### #5: No Security Headers (`Wolverine`, `Forge`, `Colossus`)
**File:** `apps/api/src/index.ts` (Fastify bootstrap)  
**Finding:** No `@fastify/helmet` or equivalent. Missing: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.  
**Fix:** Add `@fastify/helmet` and configure headers strictly. Dashboard (Next.js) should also emit CSP via `next.config.js`.

#### #6: Plaintext Spotify Tokens (`Wolverine`)
**File:** `apps/api/src/spotify.ts:160,180` — `spotifyAccounts`  
**Finding:** OAuth `refresh_token` stored without field-level encryption.  
**Fix:** Encrypt Spotify tokens with AES-256-GCM (or equivalent) using a KMS-managed key.

### 🔴 Critical — Infrastructure / Secrets

#### #7: K8s Plaintext Secret Committed (`Colossus`, `Wolverine`)
**File:** `k8s/secrets.yaml:8`  
**Finding:** `jwt-secret: "dev-secret-change-me"` in VCS.  
**Fix:** Remove from git history with `git-filter-repo` or BFG. Replace with External Secrets Operator / Sealed Secrets.

#### #8: Dockerfiles Shipping Dev Dependencies (`Colossus`)
**File:** `docker/Dockerfile.api`, `Dockerfile.dashboard`  
**Finding:** Uses `npm ci --include=dev` in production image; includes dev dependencies.  
**Fix:** Separate build stage (`npm ci --include=dev`) from production stage (`npm ci --omit=dev`.

#### #9: Postgres — No Backup (`Colossus`)
**Finding:** No `pg_dump` CronJob, no WAL archiving, no point-in-time recovery.  
**Fix:** Add K8s CronJob that runs `pg_dump` to S3-compatible storage (e.g., AWS S3 / R2 / MinIO) daily.

### 🟠 High — UX / Usability

#### #10: Dashboard Desktop-Only (`Psylocke`)
**Finding:** Fixed 240px sidebar with `ml-[240px]` main content. No hamburger or responsive drawer. Unusable on tablets or mobile.  
**Fix:** Add responsive sidebar collapse with Tailwind breakpoints; implement hamburger menu on <1024px.

#### #11: No Onboarding (`Psylocke`, `Strategy`)
**Finding:** First-time franchisee logging in sees 12 nav items with no explanation of Sync, Firmware, TakeOver.  
**Fix:** Implement role-based progressive onboarding: walkthrough tooltips for `franchisee` vs `hq_admin` vs `technician`.

#### #12: Custom Toggle Switches Inaccessible (`Psylocke`)
**File:** `apps/dashboard/app/settings/page.tsx`  
**Finding:** Settings toggles use custom styled divs instead of native `<input type="checkbox">`, breaking screen readers and keyboard access.  
**Fix:** Replace with native inputs styled via Tailwind `sr-only` + custom switch pattern.

### 🟡 Medium — Technical Debt

| Issue | File:Line | Notes |
|-------|-----------|-------|
| `any` types (46 total) | `routers/sponsor.ts:34,102`, `dashboard/firmware/page.tsx:47`, `stores/[id]/page.tsx:76`, etc. | Replace with explicit interfaces |
| No tests beyond 2 files | `apps/api/src/tests/e2e.test.ts` | Add unit + integration tests |
| 84 `console.*` calls | Throughout API | Replace with Fastify structured logger (Pino) |
| Rate limiter not wired | `apps/api/src/rate-limit.ts` | Wire into tRPC middleware + Redis backend |
| No CI/CD deploy pipeline | `.github/workflows/ci.yml` | CI ends at test; add deploy to K8s / ArgoCD / Flux |
| Missing resource limits/probes in K8s | All deployment YAMLs | Add requests/limits, liveness/readiness |
| No HPA / PDB | K8s manifests | Add Horizontal Pod Autoscaler and Pod Disruption Budgets |
| Raw error msg in readyz | `apps/api/src/index.ts:26` | `(err as Error).message` leaks internal detail |
| Staging CA placeholder | `apps/api/src/provisioning.ts:55-62` | Replace with real X.509 signing or AWS Private CA |
| `curl | sudo bash` on edge | `apps/edge-gateway/provision.sh:6` | Add checksum verification and signature validation |
| Edge Docker image digest not pinned | `provision.sh:110` | Pin to digest; prevent supply-chain compromise |
| `next.config.js` ignores build errors | `Dockerfile.dashboard` | Remove `ignoreBuildErrors: true` |

### 🟢 Low — Opportunities / Sales

- **Operational runbook:** No technician field guide for replacing LED strips or debugging ESP32-S3.
- **Public API docs:** No OpenAPI/Swagger generated from tRPC for integrators. Use `trpc-openapi`.
- **Public landing page:** README is developer-facing; buyers need a sales page with demo video.
- **Case studies:** No "Papa Pasta Sandton — One-Button MTN TakeOver" case study.
- **CHANGELOG.md:** PROGRESS.md serves this role but is internal. External consumers need a canonical changelog.
- **Pricing page / ROI calculator:** Enables self-service buying decisions.

---

## 6. Recommended Next Phase: "Production Hardening & Go-to-Market"

### Phase Goal
Fix authentication and secrets to production-ready state; enable sales and technician onboarding; position ChromaCommand as a sellable enterprise IoT platform.

### Sprint 1 (Days 1–7): Security Lockdown
1. **Restore authentication enforcement**
   - Remove `AuthGate` bypass.
   - Build actual login page with username/password (or integrate Clerk/Auth0).
   - Guard `loginWithEmail()` — throw in production unless explicitly dev-flagged.
2. **Rotate JWT secret immediately**
   - Remove hardcoded fallback in `auth.ts`.
   - Delete `k8s/secrets.yaml` from repo history (BFG / git-filter-repo).
   - Replace with External Secrets Operator (recommended: Sealed Secrets for GitOps).
3. **Move token storage to `HttpOnly` cookie**
   - Remove `localStorage` token usage.
   - Configure tRPC client with `credentials: 'include'`.
4. **Add security headers**
   - Install `@fastify/helmet` on API.
   - Configure CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
   - Dashboard `next.config.js` should emit CSP headers.
5. **Fix Dockerfiles**
   - Separate build and production stages; do not ship dev dependencies.
   - Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`.
6. **Fix K8s anti-patterns**
   - `imagePullPolicy: Always` on all deployments.
   - `ssl-redirect: "true"` in production ingress.
   - Add resource requests/limits, liveness/readiness, HPA, PDBs.
   - Add Postgres backup CronJob (pg_dump → S3).

### Sprint 2 (Week 2): Auth UX & Observability
7. **Responsive sidebar & mobile UX**
   - Hamburger menu, drawer overlay, mobile-first breakpoints.
8. **Onboarding walkthrough**
   - Role-based guided tour (HQ admin → franchisee → technician → sponsor viewer).
   - Contextual help tooltips and inline documentation.
9. **Accessible settings**
   - Replace custom div toggles with native `<input type="checkbox">` styled via Tailwind.
10. **Structured logging**
    - Replace 84 `console.*` calls with Fastify Pino logger.
    - Add security event logging: login failures, token reuse, provisioning attempts, scope violations.
11. **Observability**
    - Prometheus scraping annotations on K8s deployments.
    - Grafana dashboards for API latency, MQTT throughput, sensor telemetry pipeline.
    - Alertmanager for critical alert routing (PagerDuty / Slack).

### Sprint 3 (Week 3–4): Firmware & Edge Production Readiness
12. **MQTT production security**
    - Mosquitto: disable `allow_anonymous true`.
    - Enforce username/password auth or mTLS in production.
    - Separate dev/prod Mosquitto configs via Kustomize or Helm.
13. **OTA firmware production readiness**
    - Complete OTA implementation (if partially done).
    - Add firmware artifact versioning, rollback UI, and artifact signing.
14. **Edge provisioning security**
    - Replace staging CA placeholder with real X.509 CA or AWS Private CA.
    - Pin Docker image digests in `provision.sh`.
    - Add checksum verification to `curl | sudo bash` pattern.
    - Restrict SSH access to bastion/IP allowlisting.

### Sprint 4 (Month 2): GTM & Documentation
15. **Public product landing page**
    - Separate from GitHub README; buyer-facing copy, 2-minute demo video.
    - "One-Button Sync" hero demo with actual store transformations.
    - ROI calculator for franchise chains (per-store cost savings).
16. **Operational runbook**
    - Troubleshooting MQTT broker, edge gateway, screen player, audio node.
    - Escalation playbooks and technician field guide.
17. **API documentation**
    - Generate OpenAPI spec from tRPC routers (trpc-openapi or trpc-swagger).
    - Publish developer portal for integrators.
18. **First case study**
    - "Papa Pasta Sandton — One-Button MTN TakeOver".
    - Metrics: energy savings, sponsor revenue, technician time saved.
19. **Sales enablement**
    - One-pager, pricing sheet, competitive comparison matrix.
    - Demo mode toggle for sales presentations (clearly flagged).

### Immediate Quick Wins (Day 1)
- Remove `AuthGate` bypass and deploy to staging.
- Rotate JWT secret and delete plaintext from repo.
- Add `Demo Mode` banner to dashboard when using mock data.
- Write a `SECURITY.md` documenting known issues and remediation.

---

## 7. Acceptance Criteria

> *A developer should be able to pick up this PRD and build.*

### A. Security Must Pass Pre-Production Gate
- [ ] `AuthGate` bypass removed; login page enforces credential verification.
- [ ] `loginWithEmail()` throws in production if dev-mode bypass is enabled.
- [ ] `JWT_SECRET` has no fallback; app fails-fast on startup if unset.
- [ ] `k8s/secrets.yaml` scrubbed from git history; replaced with Sealed Secrets / External Secrets Operator.
- [ ] Dashboard token moved from `localStorage` to `HttpOnly Secure SameSite=Strict` cookie.
- [ ] `@fastify/helmet` installed and configured with CSP, HSTS, X-Frame-Options.
- [ ] Spotify tokens encrypted at field level (AES-256-GCM or equivalent).
- [ ] Mosquitto production config disables anonymous auth and enforces TLS/mTLS.
- [ ] Security event logging implemented (login failure, token reuse, provisioning).

### B. Infrastructure Must Be Production-Ready
- [ ] All K8s deployments use `imagePullPolicy: Always`.
- [ ] Ingress TLS redirect enabled (`ssl-redirect: "true"`).
- [ ] Resource requests/limits, liveness/readiness probes present on all deployments.
- [ ] HPA configured for API and dashboard.
- [ ] Postgres backup CronJob runs daily (S3-compatible storage).
- [ ] Docker images do not contain dev dependencies.
- [ ] Prometheus scraping annotations added to API and dashboard services.

### C. Dashboard Must Be Usable & Accessible
- [ ] Responsive sidebar on tablets and mobile (<1024px hamburger/drawer).
- [ ] Role-based onboarding for first-time users (HQ admin, franchisee, technician, sponsor).
- [ ] Custom toggle switches replaced with accessible native checkboxes.
- [ ] `prefers-reduced-motion` wired into Framer Motion sidebar and matrix transitions.
- [ ] `aria-live` regions for alert notifications and store status changes.
- [ ] Demo mode clearly flagged with a banner.
- [ ] Settings inputs (org name, timezone) are editable and persist via mutation.

### D. Documentation Must Be Complete
- [ ] `SECURITY.md` present with disclosed vulnerabilities and remediation status.
- [ ] Operational runbook (troubleshooting playbook) for technicians.
- [ ] API documentation auto-generated from tRPC (OpenAPI/Swagger).
- [ ] Public product landing page with demo video.
- [ ] First franchisee case study published.
- [ ] `CHANGELOG.md` maintained alongside `PROGRESS.md`.

---

## 8. Agent Assignment

| Agent | Focus Area | Key Tasks |
|-------|-----------|-----------|
| **Forge** | Backend security & auth | Fix `auth.ts` (JWT fallback, dev-mode bypass); wire rate limiter to tRPC middleware + Redis; replace 46 `any` types |
| **Beast** | Docs & runbooks | SECURITY.md, operational runbook, technician field guide, case study content, CHANGELOG.md |
| **Psylocke** | Dashboard UX | Restore auth flow, responsive sidebar, onboarding tour, accessible toggles, mobile/tablet layouts, demo mode banner |
| **Wolverine** | Security audit follow-up | Secrets rotation, Sealed Secrets migration, BFG history scrub, penetration test on staging, MQTT security review |
| **Strategy** | GTM & sales | Public landing page, demo video, pricing sheet, ROI calculator, case study, competitive comparison, partner co-marketing |
| **Colossus** | Infrastructure hardening | K8s production manifests, ArgoCD/Flux deploy pipeline, Prometheus/Grafana observability, Postgres backup, Docker optimization |

---

## 9. Cross-Links

- **Parent Brand:** [[`Papa Pasta Main Website PRD|papa-pasta-main-website]]**
- **Franchise Recruitment:** [[`Papa Pasta FND PRD|papa-pasta-fnd]]**
- **Media Partner:** [[`INFX Media Website PRD|infx-media-website]]**
- **Related Vault PRD:** No vault PRD exists (PRD.md is in repo only)
- **Design System / CODER.md:** `[[ChromaCommand CODER|vault:chromacommand CODER]]`
- **PROGRESS.md:** `[[ChromaCommand PROGRESS|vault:chromacommand PROGRESS]]`
- **Cross-repo dependency map:** See [[MASTER-SYNTHESIS-BRIEF|vault:MASTER-SYNTHESIS-BRIEF]] §Cross-repo dependencies

---

*PRD compiled by Beast (X-Mansion Research Agent) on 2026-05-24 from 6 specialist agent audits.*
