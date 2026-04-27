# ChromaCommand Platform

Unified control plane for the **Papa Pasta** franchise network — RGB lighting, digital menu boards, in-store audio, sensor telemetry, sponsor TakeOvers, and OTA firmware management. One dashboard, one MQTT broker, every store.

> See [`PRD.md`](./PRD.md) for the full product spec (v1.2) and [`PROGRESS.md`](./PROGRESS.md) for what's shipped.

---

## Architecture (one-page)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard (Next.js)  ─────────  Cloud API (Fastify + tRPC + WS)    │
│                                  ├─ Auth (JWT + refresh-rotation)    │
│                                  ├─ Schedules (node-cron)            │
│                                  ├─ Alerts (60s eval engine)         │
│                                  ├─ Provisioning (mTLS issue/renew)  │
│                                  └─ Prometheus /metrics              │
└─────────────────┬─────────────────────────┬─────────────────────────┘
                  │ Postgres                │ MQTT (mqtts:// 8883)
                  │ (23 tables)             │
                  ▼                         ▼
            ┌───────────┐         ┌────────────────────────┐
            │ Postgres  │         │ Mosquitto / EMQX       │
            │           │         │ (per-device mTLS)      │
            └───────────┘         └────────────┬───────────┘
                                               │
                                               ▼
                          ┌────────────────────────────────────┐
                          │ Edge Gateway (per store)           │
                          │  • SQLite cache                    │
                          │  • Command dedup (PRD §21.2)       │
                          │  • Sensor batch flush (60s)        │
                          │  • Local REST + WS (port 5000)     │
                          │  • Firmware fan-out                │
                          └─┬───────────┬───────────┬──────────┘
                            │           │           │
              ESP-NOW / WS  │           │ HDMI/DP   │ I²S / line-out
                            ▼           ▼           ▼
                      ┌─────────┐ ┌─────────┐ ┌─────────────┐
                      │ ESP32-S3│ │ Pi 5    │ │ Pi5+HiFiBerry│
                      │ LED ctl │ │ E-Ink + │ │ Audio        │
                      │         │ │ LCD     │ │              │
                      └─────────┘ └─────────┘ └─────────────┘
```

---

## Quickstart

### 1. Local dev with Docker Compose

```bash
git clone https://github.com/targetpraks/chromacommand-platform.git
cd chromacommand-platform
cp .env.example .env

# Bring up Postgres + Redis + Mosquitto + API + Dashboard.
# `seed` service auto-runs after Postgres is healthy.
docker compose up -d
```

- Dashboard: http://localhost:3000 → `/login` (any password works for seeded users in dev)
- API: http://localhost:4000/api/trpc
- WebSocket: ws://localhost:4000/live/ws
- Prometheus metrics: http://localhost:4000/metrics

### 2. Without Docker (manual)

```bash
npm install                      # repo root
cd packages/database && npm run db:migrate
npx tsx seed.ts                  # idempotent — safe to re-run
cd ../../apps/api && npm run dev
cd ../dashboard && npm run dev
```

---

## Seeded users (dev mode — any password works)

| Email | Role | Scope |
|-------|------|-------|
| `ricardo@infxmedia.co.za` | hq_admin | `*` (everything) |
| `regional.cpt@papapasta.co.za` | regional_manager | `region:cape-town` |
| `regional.jhb@papapasta.co.za` | regional_manager | `region:johannesburg` |
| `franchisee.a01@papapasta.co.za` | franchisee | `store:pp-a01` |
| `marketing@mtn.co.za` | sponsor_viewer | `*` |
| `tech@infxmedia.co.za` | technician | `*` |

---

## Repo layout

```
chromacommand-platform/
├── apps/
│   ├── api/             # Fastify + tRPC backend (auth, MQTT, schedules, alerts, OTA…)
│   ├── dashboard/       # Next.js 14 control console
│   └── edge-gateway/    # Per-store Node service (also dockerised)
├── packages/
│   ├── database/        # Drizzle ORM + SQL migrations + idempotent seed
│   └── shared/          # Cross-package types + tRPC router-stub
├── firmware/            # ESP32-S3 + Pi 5 device code (LED, screen, audio)
├── docker/              # API, dashboard, edge-gateway Dockerfiles
└── .github/workflows/   # CI: typecheck, build, e2e, vitest
```

---

## Provisioning a real store gateway (PRD §22)

```bash
# On the operator's laptop:
curl -fsSL -H "x-admin-key: $PROVISION_ADMIN_KEY" \
     -d '{"store_id":"pp-a01"}' \
     https://api.chromacommand.io/provision/issue
# → returns {"provisioning_code":"K9X4W7QF", "expires_in_seconds": 86400}

# On the fresh ThinkCentre Tiny (Ubuntu 24.04):
sudo PROV_CODE=K9X4W7QF API_BASE_URL=https://api.chromacommand.io \
     bash <(curl -fsSL https://api.chromacommand.io/provision/script.sh)
```

Cert auto-renews via `/etc/cron.daily/chromacommand-cert-renew` at -30 days.

---

## Sponsor TakeOver (one-button sync)

```typescript
// Dashboard → Sync page → "Activate MTN TakeOver" button
trpc.sync.transform.mutate({
  scope: "global",
  targetId: "all",
  presetId: "<MTN Yellow uuid>",
  effectiveAt: new Date().toISOString(),
  fadeDurationMs: 3000,
  components: { rgb: true, content: true, audio: true },
});
```

A `sponsor_activations` row opens automatically on sponsor presets and closes
when the next preset is applied.

`trpc.sponsor.invoice` produces a billable line-item summary joining
`sensor_telemetry.metric='impressions'` over each activation window ×
`rate_per_impression_cents`.

---

## R638 fridge compliance

A critical alert rule is seeded by default:

```
metric=temperature  comparator=>  threshold=5.0
sustained_minutes=10  scope=global  severity=critical  cooldown=30min
```

Set `webhookUrl` on the rule (Settings → Alerts) to fire Slack/Teams notifications when any fridge breaches.

---

## Deploying to production

| Component | Hosting |
|-----------|---------|
| API + Dashboard | DigitalOcean Kubernetes / AWS EKS |
| Postgres | Managed (RDS / DigitalOcean) |
| MQTT broker | EMQX cluster on EC2 (mTLS only) |
| CDN | Cloudflare R2 |
| Edge gateway | per-store ThinkCentre Tiny M90q (systemd + Docker) |

---

## CI

`.github/workflows/ci.yml` runs on every PR: typecheck → build → vitest E2E with a Postgres sidecar.

---

## License

Proprietary — Papa Pasta Franchising (PTY) Ltd.
