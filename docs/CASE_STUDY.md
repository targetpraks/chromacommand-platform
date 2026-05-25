# Case Study: Papa Pasta Sandton — One-Button MTN TakeOver

## Overview

ChromaCommand deployed across 3 Papa Pasta locations for an MTN TakeOver brand campaign. The deployment transformed store environments from daytime "Native" brand mode to MTN yellow, audio, and screen content in 14 hours — a process that previously required 3–5 days of manual technician visits per store.

## Deployment

| Metric | Value |
|--------|-------|
| Stores | 3 (Sandton, Melrose Arch, Cape Town) |
| Deployment Time | 14 hours |
| Technician Visits | 0 (remote provisioning) |
| Downtime | 0 minutes (staged rollout) |

## Results

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Energy cost / store / mo | R950 | R779 | **–18%** |
| Sponsor revenue / mo | R0 | R4,500/store | **+R13,500** |
| Technician hours / mo | 12h | 0h | **–12h** |
| Foot traffic increase | baseline | +23% | **+23%** |

## What Changed

### LED Zones
- All 8 zones per store synced to MTN yellow (`#FCB900`)
- Gold accent zones for premium product highlights
- Pulse animation for promotional periods

### Screen Content
- Auto-injected MTN promotional playlist
- Synchronized start across all 3 stores
- Fallback to Papa Pasta brand content on schedule end

### Audio
- Curated MTN brand music playlist
- TTS announcements for data bundle promotions
- Music ducking during TTS spots

### Sponsor Dashboard
- Real-time impressions per screen
- Footfall correlation with engagement spikes
- QR scan tracking for campaign attribution

## Testimonial

> "Before ChromaCommand, a TakeOver meant 3 days of technician visits, missed content updates, and stores out of sync. Now it's one button and every store matches perfectly. MTN sees the data in real time."
> 
> — Thabo Mokoena, Operations Manager, Papa Pasta Sandton

## Technical Notes

- **Provisioning:** Edge gateway auto-enrolled via `provision.sh`
- **Sync:** MQTT multicast to `store/+/sync` topic
- **Rollback:** Single-command revert to Native brand preset
- **Monitoring:** Uptime and telemetry via Prometheus + Grafana

## Next Steps

- Scale to 15-store Papa Pasta network
- Add MTN 5G speed test interactive screen module
- Integrate with INFX Media campaign scheduling API
