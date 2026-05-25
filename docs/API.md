# ChromaCommand API Documentation

Base URL: `http://localhost:4000/api/trpc`  
Protocol: tRPC over HTTP (batch link) + WebSocket live events  
Auth: JWT Bearer token in `Authorization` header; refresh token in `HttpOnly` cookie `__Host-refresh`.

---

## Router Overview

| Router | Description |
|--------|-------------|
| `auth` | Login, refresh, logout, session management |
| `stores` | Store CRUD, zone/screen/audio lookup |
| `rgb` | LED presets and per-store colour control |
| `content` | Content assets, playlists, screen assignments |
| `audio` | Zone state, playback control, TTS announcements |
| `sync` | One-Button Sync transforms and rollback |
| `analytics` | Telemetry stats, activity log, content performance |
| `sponsor` | Sponsor campaign data, activations, billing |
| `telemetry` | Sensor telemetry, heartbeats, hourly aggregates |
| `schedules` | Cron-based RGB preset scheduling |
| `firmware` | OTA releases, deployments, result reporting |
| `alerts` | Alert rules and fired events |
| `spotify` | Spotify Connect OAuth, playback control |
| `health` | Public ping endpoint |

---

### Auth Requirements Key

| Badge | Meaning |
|-------|---------|
| 🌐 | `publicProcedure` — no auth required |
| 🔒 | `protectedProcedure` — valid JWT required |
| 👔 `hq_admin` | `requireRole("hq_admin")` (or listed roles) |
| 🗺️ | `requireScope(...)` — valid JWT + user scope covers target |

---

## auth

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `login` | mutation | `{ email: string, password: string }` | `{ token, refreshToken, user }` | 🌐 |
| `refresh` | mutation | `{ refreshToken: string }` | `{ token, refreshToken }` | 🌐 |
| `logout` | mutation | `{ refreshToken?: string }` | `{ ok: boolean }` | 🔒 |
| `logoutAll` | mutation | — | `{ ok: boolean }` | 🔒 |
| `me` | query | — | `AuthUser` | 🔒 |

---

## stores

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `list` | query | `{ regionId?: string }` | `Store[]` with zones, screens, audio zones joined | 🔒 |
| `get` | query | `{ id: string }` | Single store with full zone/screen/audio data | 🔒 |

**Store output shape:** `id, name, region, status, zones[], screens, activeContent, lastHeartbeat, audioZone`

---

## rgb

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `listPresets` | query | — | `RGBPreset[]` | 🔒 |
| `getState` | query | `{ storeId: string }` | `{ storeId, zones[] }` | 🔒 |
| `multiGetState` | query | `{ storeIds: string[] }` | `Record<storeId, { storeId, zones[] }>` | 🔒 |
| `set` | mutation | `{ scope, targetId, zone?, colour: { mode, primary, secondary?, brightness, speed }, fadeMs }` | `{ commandId, status, mqttTopic }` | 🗺️ |

---

## content

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `listAssets` | query | — | `Asset[]` | 🔒 |
| `createAsset` | mutation | `{ name, type, htmlContent?, css?, dimensions?, durationSeconds, priority, tags, validFrom?, validUntil? }` | `{ assetId, status }` | 👔 `hq_admin`, `regional_manager` |
| `listPlaylists` | query | — | `Playlist[]` | 🔒 |
| `assignPlaylist` | mutation | `{ playlistId, scope, targetId, screenIds? }` | `{ status, scope, targetId }` | 👔 `hq_admin`, `regional_manager` |
| `storeScreens` | query | `{ storeId: string }` | `Screen[]` | 🔒 |

---

## audio

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `getZoneState` | query | `{ storeId: string }` | `{ id, zoneType, sinkName, volume, status }[]` | 🔒 |
| `set` | mutation | `{ scope, targetId, zone, playlistId?, action, volume?, fadeMs? }` | `{ commandId, status, mqttTopic }` | 🗺️ |
| `announce` | mutation | `{ scope, targetId, zones[], text, voice?, volume?, duckMusic?, priority? }` | `{ commandId, status, mqttTopic }` | 🗺️ |
| `getPlaylistLibrary` | query | — | `Playlist[]` | 🔒 |

---

## sync

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `transform` | mutation | `{ scope, targetId, presetId, effectiveAt, fadeDurationMs, components: { rgb, content, audio } }` | Sync dispatch result + `commandId` | 🗺️ |
| `recent` | query | `{ limit?: number }` | `SyncTransaction[]` | 🔒 |
| `rollback` | mutation | `{ commandId: string }` | Rollback result | 🗺️ |

---

## analytics

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `getStats` | query | `{ storeId?, period?: "today"|"week"|"month" }` | `{ source, impressions, footfall, qrScans, avgDwellMinutes }` | 🔒 |
| `getContentPerformance` | query | — | `{ name, views, time, share }[]` | 🔒 |
| `getActivityLog` | query | `{ limit?, offset? }` | `ActivityLogEntry[]` | 🔒 |

---

## sponsor

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `getCampaignData` | query | `{ sponsorName?, storeIds?, period? }` | Campaign summary + per-store stats | 👔 `hq_admin`, `sponsor_viewer`, `regional_manager` |
| `getTimeSeries` | query | `{ sponsorName?, period? }` | Daily impressions/footfall/qrScans series | 👔 `hq_admin`, `sponsor_viewer`, `regional_manager` |
| `listActivations` | query | `{ sponsorName?, since?, until?, status? }` | `SponsorActivation[]` | 👔 `hq_admin`, `sponsor_viewer`, `regional_manager` |
| `invoice` | query | `{ activationIds }` | Invoice line items (placeholder) | 👔 `hq_admin`, `sponsor_viewer`, `regional_manager` |

---

## telemetry

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `getSeries` | query | `{ storeId, metric, sinceMinutes?, bucketMinutes? }` | Bucketed `{ bucket, avg_value, sum_value, samples }[]` | 🔒 |
| `latest` | query | `{ metric, storeId? }` | `SensorTelemetry[]` | 🔒 |
| `hourlyAggregate` | query | `{ storeId, metric, sinceHours? }` | Pre-aggregated hourly stats (MV fallback) | 🔒 |
| `liveDevices` | query | `{ withinMinutes? }` | `DeviceHeartbeat[]` | 🔒 |
| `ingest` | mutation | `{ storeId, deviceId, metric, value, unit? }` | `{ ok: boolean }` | 👔 `technician`, `hq_admin` |

---

## schedules

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `list` | query | `{ targetId? }` | `RGBSchedule[]` | 🔒 |
| `create` | mutation | `{ name, presetId, scope, targetId, cronExpression, timezone?, active?, priority? }` | `RGBSchedule` | 🗺️ |
| `update` | mutation | `{ id, patch: { name?, presetId?, threshold?, ... } }` | `RGBSchedule` | 👔 `hq_admin`, `regional_manager` |
| `remove` | mutation | `{ id: string }` | `{ ok: boolean }` | 👔 `hq_admin`, `regional_manager` |
| `activeJobs` | query | — | `{ name, nextRun }[]` | 👔 `hq_admin`, `technician` |

---

## firmware

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `listReleases` | query | `{ deviceClass? }` | `FirmwareRelease[]` | 🔒 |
| `createRelease` | mutation | `{ deviceClass, version, url, sha256, sizeBytes?, notes? }` | `FirmwareRelease` | 👔 `hq_admin`, `technician` |
| `deploy` | mutation | `{ releaseId, scope, targetId }` | `{ deploymentId, commandId, totalDevices }` | 🗺️ |
| `reportResult` | mutation | `{ deploymentId, outcome, deviceId?, error? }` | `{ successCount, failureCount, status }` | 👔 `hq_admin`, `technician` |
| `listDeployments` | query | `{ targetId? }` | `FirmwareDeployment[]` | 🔒 |

---

## alerts

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `listRules` | query | — | `AlertRule[]` | 🔒 |
| `recentEvents` | query | `{ storeId?, limit? }` | `AlertEvent[]` | 🔒 |
| `createRule` | mutation | `{ name, description?, metric, comparator, threshold, sustainedMinutes?, scope, targetId, severity?, webhookUrl?, cooldownMinutes?, active? }` | `AlertRule` | 👔 `hq_admin`, `regional_manager` |
| `updateRule` | mutation | `{ id, patch }` | `AlertRule` | 👔 `hq_admin`, `regional_manager` |
| `deleteRule` | mutation | `{ id }` | `{ ok: boolean }` | 👔 `hq_admin` |
| `evalNow` | mutation | — | `{ ok: boolean }` | 👔 `hq_admin`, `technician` |
| `summary` | query | `{ hours? }` | `{ severity, fired, resolved, active }[]` | 🔒 |

---

## spotify

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `listAccounts` | query | — | `SpotifyAccount[]` | 🔒 |
| `authorizeUrl` | query | `{ scope?, targetId? }` | `{ url: string }` | 🔒 |
| `disconnect` | mutation | `{ accountId }` | `{ ok: boolean }` | 👔 `hq_admin`, `regional_manager` |
| `listPlaylists` | query | `{ scope?, targetId?, limit? }` | `{ total, items[] }` | 🔒 |
| `search` | query | `{ q, type?, limit? }` | Search results array | 🔒 |
| `listDevices` | query | `{ scope?, targetId? }` | `SpotifyDevice[]` | 🔒 |
| `nowPlaying` | query | `{ scope?, targetId? }` | Currently playing track object or `null` | 🔒 |
| `playToScope` | mutation | `{ scope, targetId, playlistUri, deviceId?, positionMs? }` | `{ commandId, affectedStores, directPlayback }` | 🗺️ |
| `pause` | mutation | `{ scope, targetId }` | `{ commandId, affectedStores, directPlayback }` | 🗺️ |
| `setVolume` | mutation | `{ scope, targetId, volumePercent }` | `{ ok, error? }` | 🗺️ |

---

## health

| Endpoint | Type | Input | Output | Auth |
|----------|------|-------|--------|------|
| `ping` | query | — | `{ status: "ok", version: string }` | 🌐 |

---

## Error Codes

| HTTP | tRPC code | Meaning |
|------|-----------|---------|
| 400 | `BAD_REQUEST` | Invalid input (Zod validation failure) |
| 401 | `UNAUTHORIZED` | Missing, expired, or revoked JWT/refresh token |
| 403 | `FORBIDDEN` | Authenticated but role/scope insufficient |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource already exists or state mismatch |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded (login burst protection) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error — check API logs |
