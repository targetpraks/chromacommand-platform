/**
 * ChromaCommand Screen Player v2 — digital menu kiosk (Raspberry Pi 5 / Electron)
 *
 * Transport: local MQTT on the edge gateway (chromacommand/local/…).
 *   Subscribes: chromacommand/local/content/{SCREEN_ID}/command
 *               chromacommand/local/content/all/command
 *   Publishes:  device register/heartbeat/offline(LWT), content/state,
 *               command acks.
 *
 * Playback:
 *   • Playlists arrive as ordered asset lists; every asset body is cached to
 *     disk under ~/.chromacommand-cache so playback survives WAN outages
 *     (the v1 "offline cache" was a TODO stub showing a placeholder).
 *   • Commands supported: set_playlist, push_asset, show_emergency,
 *     clear_overlay, reload, set_brightness, reboot.
 *
 * Run on Pi:  SCREEN_ID=pp-a01-menu-primary STORE_ID=pp-a01 \
 *             LOCAL_MQTT_URL=mqtt://<gateway-ip>:1883 npm start
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const mqtt = require('mqtt');

// ─── Config ───────────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  screenId: process.env.SCREEN_ID || 'unprovisioned-screen',
  localMqttUrl: process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883',
  gatewayApiBase: process.env.GATEWAY_API_BASE || '', // optional REST fallback
  cacheDir: process.env.CACHE_DIR || path.join(os.homedir(), '.chromacommand-cache'),
  heartbeatMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
};

const FIRMWARE_VERSION = '2.0.0';
const deviceId = `${CONFIG.screenId}-player`;
const PREFIX = 'chromacommand/local';

fs.mkdirSync(CONFIG.cacheDir, { recursive: true });

// ─── State ────────────────────────────────────────────────────────────────
let win = null;
let playlist = null;          // { playlist_id, items: [{assetId, html, css, durationSeconds}] }
let currentItem = -1;
let advanceTimer = null;
let overlayHtml = null;       // emergency/push override; non-null wins over playlist
let brightness = 100;
let client = null;

// ─── Asset cache ──────────────────────────────────────────────────────────
function cachePath(assetId) {
  const safe = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CONFIG.cacheDir, `${safe}.json`);
}

function readCache(assetId) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(assetId), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(assetId, data) {
  try {
    fs.writeFileSync(cachePath(assetId), JSON.stringify(data));
  } catch (err) {
    console.error('cache write:', err.message);
  }
}

function fetchUrl(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 10_000 }, (res) => {
      if ([301, 302, 307].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(fetchUrl(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('fetch timeout')); });
  });
}

/** Resolve an asset to renderable HTML — network first, cache fallback. */
async function resolveAsset(item) {
  const cached = readCache(item.assetId);
  if (item.html && item.css !== undefined) {
    // Fresh copy from the cloud payload — refresh the disk cache.
    writeCache(item.assetId, { html: item.html, css: item.css || '' });
    return { html: item.html, css: item.css || '' };
  }
  if (item.url) {
    try {
      const html = await fetchUrl(item.url);
      writeCache(item.assetId, { html });
      return { html };
    } catch (err) {
      console.warn(`fetch failed (${err.message}) — using cache`);
    }
  }
  if (cached) return cached;
  return { html: `<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#0d1526;color:#64748b;font-family:sans-serif">Papa Pasta</div>` };
}

// ─── Rendering ────────────────────────────────────────────────────────────
/** Escape then substitute {{var}} tokens — no raw HTML interpolation of data. */
function renderTemplate(html, vars = {}) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? '' : String(v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  });
}

async function showItem(index) {
  if (!playlist || !playlist.items || playlist.items.length === 0) return;
  const idx = ((index % playlist.items.length) + playlist.items.length) % playlist.items.length;
  const item = playlist.items[idx];
  const asset = await resolveAsset(item);

  const style = asset.css ? `<style>${asset.css}</style>` : '';
  const html = `<!DOCTYPE html><html><head><style>
      html,body{margin:0;padding:0;overflow:hidden;background:#0d1526;width:100%;height:100%}
      iframe,img{border:0}
    </style>${style}</head>
    <body>${renderTemplate(asset.html)}</body></html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  currentItem = idx;
  publishState({ playing: item.assetId, index: idx });

  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(advance, (item.durationSeconds || 15) * 1000);
}

function advance() {
  if (!overlayHtml && playlist) showItem(currentItem + 1);
}

function showOverlay(html) {
  clearTimeout(advanceTimer);
  overlayHtml = true;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function clearOverlay() {
  overlayHtml = null;
  if (playlist) showItem(Math.max(currentItem, 0));
}

// ─── Command handling ─────────────────────────────────────────────────────
async function handleCommand(cmd) {
  const commandId = cmd.command_id;
  const ack = (status, detail) =>
    publish(`${PREFIX}/command/ack`, { command_id: commandId, device_id: deviceId, status, detail });

  try {
    switch (cmd.cmd) {
      case 'set_playlist':
        playlist = {
          playlist_id: cmd.playlist_id,
          items: Array.isArray(cmd.items) ? cmd.items : [],
        };
        if (playlist.items.length > 0) {
          overlayHtml = null;
          showItem(0);
        }
        break;

      case 'push_asset':
        playlist = { playlist_id: cmd.asset_id, items: [{ assetId: cmd.asset_id, durationSeconds: cmd.duration_seconds || 60 }] };
        overlayHtml = null;
        showItem(0);
        break;

      case 'show_emergency':
        showOverlay(`<!DOCTYPE html><html><body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:${cmd.background_color || '#C62828'};color:#fff;font-family:sans-serif;text-align:center">
          <h1 style="font-size:9vmin">${cmd.heading || 'NOTICE'}</h1>
          <p style="font-size:4vmin;max-width:80vw">${cmd.body || ''}</p></body></html>`);
        break;

      case 'clear_overlay':
        clearOverlay();
        break;

      case 'reload':
        win.webContents.reload();
        break;

      case 'set_brightness':
        brightness = Math.min(Math.max(cmd.brightness ?? 100, 10), 100);
        // Linux DRM backlight when available; no-op otherwise.
        try {
          const fs2 = require('fs');
          const candidates = ['/sys/class/backlight/rpi_backlight/brightness'];
          for (const p of candidates) {
            if (fs2.existsSync(p)) {
              fs2.writeFileSync(p, String(Math.round((brightness / 100) * 255)));
              break;
            }
          }
        } catch {}
        break;

      case 'reboot':
        ack('executed');
        setTimeout(() => {
          if (process.platform === 'linux') require('child_process').exec('sudo systemctl reboot');
          else app.quit();
        }, 500);
        return; // ack already sent

      default:
        ack('failed', `unknown cmd ${cmd.cmd}`);
        return;
    }
    ack('executed');
  } catch (err) {
    ack('failed', err.message.slice(0, 200));
  }
}

// ─── MQTT ─────────────────────────────────────────────────────────────────
function publish(topic, payload, opts = {}) {
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(payload), { qos: 1, ...opts });
  }
}

function publishState(extra = {}) {
  publish(`${PREFIX}/state/content/${CONFIG.screenId}`, {
    screen_id: CONFIG.screenId,
    playlist_id: playlist?.playlist_id ?? null,
    index: currentItem,
    overlay: !!overlayHtml,
    ...extra,
  });
}

function connect() {
  client = mqtt.connect(CONFIG.localMqttUrl, {
    clientId: deviceId,
    reconnectPeriod: 5000,
    keepalive: 30,
    will: {
      topic: `${PREFIX}/device/offline`,
      payload: JSON.stringify({ device_id: deviceId }),
      qos: 0,
      retain: false,
    },
  });

  client.on('connect', () => {
    console.log('🏠 connected to local bus');
    publish(`${PREFIX}/device/register`, {
      device_id: deviceId,
      device_type: 'screen_player',
      entity_ref: CONFIG.screenId,
      store_hint: CONFIG.storeId,
      version: FIRMWARE_VERSION,
      ip: Object.values(require('os').networkInterfaces()).flat().find((n) => n.family === 'IPv4' && !n.internal)?.address,
    });
    client.subscribe([`${PREFIX}/content/${CONFIG.screenId}/command`, `${PREFIX}/content/all/command`], { qos: 1 });

    // Pull retained set_playlist so we resume after a reboot.
    client.publish(`${PREFIX}/content/${CONFIG.screenId}/command/resume-ping`, '{}');
  });

  client.on('message', (topic, message) => {
    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch {
      return;
    }
    if (msg.cmd) handleCommand(msg);
  });

  client.on('error', (err) => console.error('mqtt:', err.message));

  setInterval(() => {
    publish(`${PREFIX}/device/heartbeat`, { device_id: deviceId, version: FIRMWARE_VERSION });
    publishState();
  }, CONFIG.heartbeatMs);
}

// ─── Electron ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  win = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    kiosk: process.platform === 'linux',
    webPreferences: {
      nodeIntegration: false,       // hardened vs v1 (was true + contextIsolation off)
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setFullScreen(true);
  showItem(0);
  connect();
});

app.on('window-all-closed', () => app.quit());
