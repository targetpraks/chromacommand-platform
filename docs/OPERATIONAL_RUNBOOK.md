# ChromaCommand Operational Runbook

Version: Sprint 3  
Owner: Infinity Brands TechOps

---

## 1. MQTT Broker Connectivity

### Symptoms
- Matrix View shows stores as `offline` with red status dots.
- Edge gateway logs contain `Connection refused` or `ECONNREFUSED`.
- No MQTT messages reach `chromacommand/store/{id}/#` topics.

### Quick Checks

| Step | Command / Action | Expected Result |
|------|------------------|----------------|
| 1 | `docker compose ps mqtt` | Container status `Up (healthy)` |
| 2 | `mosquitto_sub -h localhost -t "chromacommand/store/+/heartbeat" -v` | Heartbeat JSON payloads stream in |
| 3 | `docker logs --tail 50 edge-gateway` | No repeated `reconnecting …` lines |

### Common Causes & Remediation

| Cause | Remediation |
|-------|-------------|
| Mosquitto not listening on 1883 | Check `mosquitto.conf` has `listener 1883` and `allow_anonymous true` (local dev) or ACL file (prod). |
| API `MQTT_BROKER_URL` misconfigured | Verify `.env` / `docker-compose.yml` points to `mqtt://mqtt:1883` (Docker) or correct public IP (self-hosted). |
| Edge-gateway container restarted | Wait 10s — it has exponential back-off (`reconnectPeriod: 5000`). If still failing, inspect gateway `MQTT_BROKER_URL` env var. |
| TLS cert mismatch (prod) | Ensure `cafile` in mosquitto matches the client cert mounted in `edge-gateway`. Rotate both together. |

### Restart Sequence
```bash
docker compose restart mqtt
docker compose restart edge-gateway
```

---

## 2. Edge Gateway Offline Detection

### Symptoms
- Dashboard last heartbeat > 60s for a store.
- `deviceHeartbeats` table gap > 5 minutes.
- Gateway container exits with code 1.

### Quick Checks

| Step | Action |
|------|--------|
| 1 | `docker ps | grep edge-gateway` — is it running? |
| 2 | `docker logs edge-gateway --tail 100` — last error line? |
| 3 | Check store LED physical power (ESP32-S3 USB-C supply). |

### Decision Tree

```
Gateway container down?
  → Yes → Restart container.
      → Still down? → Check disk space (`df -h`).
      → Still down? → Replace Pi hardware (see §5).
  → No → MQTT bridge alive? (`mosquitto_sub` see §1).
      → Yes → Check SQLite cache file integrity.
      → No  → Follow §1 MQTT remediation.
```

---

## 3. Screen Player Content Rendering Failures

### Symptoms
- TVs show black screen, "No Signal", or stale content.
- `screens` table shows `status = offline`.
- Electron kiosk does not respond to `content/playlist` MQTT commands.

### Quick Checks

| Step | Action | Expected |
|------|--------|----------|
| 1 | SSH into Pi running screen-player: `systemctl status chroma-screen` | `active (running)` |
| 2 | Check Pi HDMI output: `tvservice -s` | `HDMI attached` with resolution |
| 3 | Tail logs: `journalctl -u chroma-screen -f -n 50` | No repeated `ERR_CONNECTION_REFUSED` |
| 4 | Verify content asset URL reachable from Pi: `curl -I {asset_url}` | `HTTP 200` |

### Remediation

| Cause | Action |
|-------|--------|
| Content asset URL 404 / signed URL expired | Re-upload asset via Dashboard → Content Manager and re-assign playlist. |
| Electron GPU process crash | Restart service: `sudo systemctl restart chroma-screen`. If recurring, add `--disable-gpu` to Electron flags in `firmware/screen-player/player.js`. |
| Playlist empty / no assignments | Dashboard → Content Manager → assign playlist to store + screen IDs. |
| Network drop on Pi | `ping 8.8.8.8` — if high loss, swap Ethernet cable / verify Wi-Fi credentials. |

---

## 4. Audio Player MPD Connection Issues

### Symptoms
- No audio in store zones.
- `audioZones` table status = `offline`.
- Dashboard Audio Control play button yields "Dispatched" but no sound.

### Quick Checks

| Step | Command | Expected |
|------|---------|----------|
| 1 | `systemctl status mpd` on audio Pi | `active (running)` |
| 2 | `mpc status` | Shows `volume: 45%`, state, current song |
| 3 | `cat /var/log/mpd/mpd.log \| tail` | No `avformat_open_input failed` |
| 4 | `curl http://audio-pi:6600` | Plain-text MPD protocol response |

### Remediation

| Cause | Action |
|-------|--------|
| MPD not running | `sudo systemctl restart mpd` then `mpc play`. |
| Playlist file path wrong | Re-generate playlist in `firmware/audio-player/audio.js`; ensure paths match local mount (`/mnt/music/`). |
| Sink/zone mapping mismatch | Verify `audioZones.sinkName` in DB matches ALSA device names (`aplay -L`). |
| MPD port blocked by firewall | `sudo ufw allow 6600/tcp`. |
| TTS (Piper/espeak) not installed | `sudo apt install espeak-ng` or ensure `piper` binary is in `$PATH`. |

---

## 5. Escalation Playbook: Restart vs. Replace

| Symptom | Restart First? | Replace Hardware? | Notes |
|---------|---------------|-------------------|-------|
| Gateway container crash | ✅ Docker restart | If 3 restarts in 15 min | Check `dmesg` for OOM kills |
| ESP32-S3 not joining Wi-Fi | ✅ Power cycle USB-C | If flash corrupted | See §6 below |
| Pi SD card read-only | ❌ | ✅ Immediately | Remount as read-only = failing flash |
| Screen black after reboot | ✅ Restart Electron | If HDMI IC blown | Swap Pi / HDMI cable |
| Audio DAC hiss/crackle | ✅ Check 3.5mm jack | If DAC chip burnt | LED-gate electrical isolation review |
| MQTT broker rejects all clients | ✅ Restart mosquitto | If disk full | Check `/var/log/mosquitto/` size |

**Replace hardware when:** physical damage, 3+ restarts within 10 minutes, SD/eMMC corruption, or >24h MTTR on restart attempts.

---

## 6. Technician Field Guide

### LED Strip Replacement (WS2812B / SK6812)

1. **Safety** — Disconnect 5V power supply at the controller; never hot-swap strips.
2. **Identify fault** — Use multimeter continuity mode across `+5V`, `GND`, `DATA` at the cut point.
3. **Cut & splice** — Cut on copper pads; solder new segment preserving `DATA → DO → DI` direction.
4. **Test before sealing** — Power on briefly; first LED should light in default colour.
5. **Waterproof** — If exterior zone, re-apply silicone heat-shrink or IP67 casing.
6. **Update zone config** — Dashboard → Store Detail → verify `ledCount` matches new strip length.

### ESP32-S3 Flashing

**Prerequisites:** ESP32-S3 dev board, USB-C cable, `esptool.py` or PlatformIO.

1. **Enter download mode:**
   - Hold **BOOT** button → press **RESET** → release **BOOT**.
2. **Flash firmware:**
   ```bash
   esptool.py --chip esp32s3 --port /dev/ttyACM0 write_flash 0x0000 led_controller.ino.bin
   ```
3. **Verify:**
   - `picocom /dev/ttyACM0 -b 115200` — look for `Chroma LED Controller init OK`.
4. **Provision Wi-Fi:**
   - Hard-coded in `firmware/led-controller/led_controller.ino` or via captive portal (if `WIFI_SSID` is empty).
5. **Register in dashboard:**
   - Store Detail → Zones → ensure `deviceId` matches MAC address printed on boot.

### Edge Pi Provisioning

1. Write latest RaspiOS image to SD card with Raspberry Pi Imager.
2. Pre-configure `wpa_supplicant.conf` and `ssh` empty file on boot partition.
3. Boot Pi; SSH in.
4. Install Node.js 20 LTS and `pm2`.
5. Clone repo, `cd apps/edge-gateway`, `npm install`, `cp .env.example .env`.
6. Set `PROVISION_ADMIN_KEY` and `PROVISION_BROKER_URL`.
7. `pm2 start gateway.js --name chroma-edge`.
8. Verify with `pm2 logs chroma-edge` — expect `MQTT connected` and `WebSocket listening on :8081`.

---

## 7. Contacts & Escalation

| Role | Contact |
|------|---------|
| TechOps On-Call | #techops-alerts Slack / PagerDuty rotation |
| Security incidents | security@infinitybrands.co.za |
| Firmware/hardware vendor | See procurement sheet in Drive |
| Infinity Brands HQ | +27 21 555 0199 |
