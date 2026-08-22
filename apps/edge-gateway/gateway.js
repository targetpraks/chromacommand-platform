/**
 * ChromaCommand Edge Gateway v2 — per-store bridge on ThinkCentre Tiny.
 *
 * Architecture: cloud MQTT  ⇄  gateway  ⇄  local MQTT (device bus)
 *
 *   • LED controllers (ESP32-S3), kiosk players (Pi5/Electron) and audio
 *     nodes all speak MQTT against a LOCAL broker running on the gateway
 *     host (mosquitto, localhost:1883). One transport, retained state,
 *     Last-Will offline detection — no ESP-NOW hop.
 *
 *   • The gateway subscribes to this store's topics on the cloud broker and
 *     translates them onto the local bus; device state/acks/heartbeats flow
 *     back up so the cloud command ledger closes the dispatch→ack loop.
 *
 *   • Offline resilience: clean:false + stable client id → the cloud broker
 *     queues QoS1 commands while we're away. Retained messages on the local
 *     bus restore device state after a reboot. Sensor samples buffer in
 *     SQLite and flush only when the upstream publish is acked.
 *
 * Local topic map:
 *   cc/local/rgb/{zone}/set            ← rgb/set/{zone}
 *   cc/local/audio/{zone}/set          ← audio/set/{zone}
 *   cc/local/audio/announce            ← audio/announce
 *   cc/local/audio/playlist            ← audio/playlist
 *   cc/local/audio/spotify/{action}    ← audio/spotify/{action}
 *   cc/local/content/all/command       ← content/command | content/playlist
 *   cc/local/firmware/install          ← firmware/install
 *   cc/local/device/register|heartbeat|offline   (devices → gateway)
 *   cc/local/device/ack                (devices → cloud command/ack)
 *   cc/local/state/rgb|audio|content/… (devices → cloud state)
 */

const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const os = require('os');

// ─── Configuration ────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  regionId: process.env.REGION_ID || 'cape-town',
  cloudBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  localBrokerUrl: process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883',
  clientId: `edge-${process.env.STORE_ID || 'pp-a01'}`, // STABLE — clean:false session depends on it
  dbPath: process.env.DB_PATH || './edge_cache.db',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
};

const CLOUD_PREFIX = 'chromacommand';
const LOCAL_PREFIX = 'chromacommand/local';

// ─── SQLite Local Cache ──────────────────────────────────────────────────
const db = new sqlite3.Database(CONFIG.dbPath, (err) => {
  if (err) console.error('SQLite error:', err);
  else console.log('📦 Local cache initialised');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS led_state (
      zone_id TEXT PRIMARY KEY,
      colour TEXT DEFAULT '#1B2A4A',
      secondary TEXT,
      brightness REAL DEFAULT 0.85,
      mode TEXT DEFAULT 'solid',
      speed REAL DEFAULT 1.0,
      segments TEXT,
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS content_manifest (
      screen_id TEXT PRIMARY KEY,
      hash TEXT,
      playlist_id TEXT,
      last_sync INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audio_state (
      zone TEXT PRIMARY KEY,
      playlist_id TEXT,
      volume REAL DEFAULT 0.5,
      status TEXT DEFAULT 'stopped',
      source TEXT DEFAULT 'local'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS command_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id TEXT,
      type TEXT,
      payload TEXT,
      status TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
  // PRD §21.2 ring buffer — populated ONLY after successful execution so a
  // failed command can be retried with the same id.
  db.run(`
    CREATE TABLE IF NOT EXISTS command_dedupe (
      command_id TEXT PRIMARY KEY,
      seen_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_buffer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT,
      metric TEXT,
      value REAL,
      recorded_at INTEGER DEFAULT (strftime('%s','now')),
      sent INTEGER DEFAULT 0
    )
  `);
  // Device registry — who is on the local bus right now.
  db.run(`
    CREATE TABLE IF NOT EXISTS device_registry (
      device_id TEXT PRIMARY KEY,
      device_type TEXT,
      entity_ref TEXT,
      version TEXT,
      ip TEXT,
      status TEXT DEFAULT 'online',
      last_seen INTEGER DEFAULT (strftime('%s','now'))
    )
  `);
});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/** True if we've already executed this id. Does NOT claim — mark only after success. */
async function isDuplicateCommand(commandId) {
  if (!commandId) return false;
  const row = await dbGet('SELECT 1 FROM command_dedupe WHERE command_id = ?', [commandId]);
  return !!row;
}

async function markCommandSeen(commandId) {
  if (!commandId) return;
  await dbRun('INSERT OR IGNORE INTO command_dedupe (command_id) VALUES (?)', [commandId]);
  await dbRun(`DELETE FROM command_dedupe WHERE rowid NOT IN
    (SELECT rowid FROM command_dedupe ORDER BY rowid DESC LIMIT 1000)`);
}

// ─── Cloud MQTT Client ────────────────────────────────────────────────────
const cloudOptions = {
  clientId: CONFIG.clientId,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  clean: false, // persistent session — broker queues QoS1 while we're offline
  rejectUnauthorized: process.env.MQTT_INSECURE !== '1',
};

if (CONFIG.cloudBrokerUrl.startsWith('mqtts://')) {
  const certPath = process.env.MQTT_CLIENT_CERT || '/etc/chromacommand/cert.pem';
  const keyPath = process.env.MQTT_CLIENT_KEY || '/etc/chromacommand/key.pem';
  const caPath = process.env.MQTT_CA_CERT || '/etc/chromacommand/ca.pem';
  if (require('fs').existsSync(certPath)) cloudOptions.cert = require('fs').readFileSync(certPath);
  if (require('fs').existsSync(keyPath)) cloudOptions.key = require('fs').readFileSync(keyPath);
  if (require('fs').existsSync(caPath)) cloudOptions.ca = require('fs').readFileSync(caPath);
  console.log(cloudOptions.cert && cloudOptions.key ? '🔐 mTLS enabled — using device cert' : '⚠️  mqtts:// configured but no device cert found');
}

const cloud = mqtt.connect(CONFIG.cloudBrokerUrl, cloudOptions);

cloud.on('connect', () => {
  console.log('☁️  Connected to cloud MQTT broker');
  const storeBase = `${CLOUD_PREFIX}/store/${CONFIG.storeId}`;
  const topics = [
    `${storeBase}/rgb/set/+`,
    `${storeBase}/content/playlist`,
    `${storeBase}/content/diff`,
    `${storeBase}/content/command`,
    `${storeBase}/audio/set/+`,
    `${storeBase}/audio/playlist`,
    `${storeBase}/audio/announce`,
    `${storeBase}/sync/transform`,
    `${storeBase}/firmware/install`,
    `${storeBase}/audio/spotify/play`,
    `${storeBase}/audio/spotify/pause`,
    `${CLOUD_PREFIX}/global/rgb/set`,
    `${CLOUD_PREFIX}/global/content/command`,
    `${CLOUD_PREFIX}/global/audio/set`,
    `${CLOUD_PREFIX}/region/${CONFIG.regionId}/rgb/set`,
    `${CLOUD_PREFIX}/region/${CONFIG.regionId}/content/command`,
  ];
  cloud.subscribe(topics, { qos: 1 }, (err) => {
    if (err) console.error('Cloud subscribe error:', err.message);
    else console.log('📡 Subscribed to', topics.length, 'cloud topics (qos1)');
  });
  startHeartbeat();
});

cloud.on('message', (topic, message) => {
  handleCloudMessage(topic, message.toString()).catch((err) =>
    console.error('cloud handler:', err.message)
  );
});
cloud.on('error', (err) => console.error('MQTT error:', err.message));
cloud.on('offline', () => console.log('☁️  Disconnected from cloud — offline mode'));

async function publishUpstream(topic, payload, qos = 1) {
  return new Promise((resolve, reject) => {
    cloud.publish(topic, JSON.stringify(payload), { qos }, (err) => (err ? reject(err) : resolve()));
  });
}

function ackUpstream(commandId, deviceId, status, detail) {
  if (!cloud.connected) return;
  publishUpstream(
    `${CLOUD_PREFIX}/store/${CONFIG.storeId}/command/ack`,
    { command_id: commandId, device_id: deviceId, status, detail, ts: Date.now() },
    1
  ).catch(() => {});
}

// ─── Local MQTT Client (device bus) ───────────────────────────────────────
let local = null;
let localReady = false;

function connectLocal() {
  local = mqtt.connect(CONFIG.localBrokerUrl, {
    clientId: `edge-local-${CONFIG.storeId}`,
    reconnectPeriod: 5000,
    connectTimeout: 5000,
    will: {
      topic: `${LOCAL_PREFIX}/gateway/offline`,
      payload: JSON.stringify({ store_id: CONFIG.storeId, ts: Date.now() }),
      qos: 0,
      retain: false,
    },
  });

  local.on('connect', async () => {
    if (localReady) return;
    localReady = true;
    console.log('🏠 Connected to local device bus');
    local.subscribe(`${LOCAL_PREFIX}/#`, { qos: 1 }, () => {});
    announceGatewayPresence();
    await replayCachedState();
  });

  local.on('close', () => { localReady = false; });
  local.on('error', (err) => console.error('local mqtt:', err.message));

  local.on('message', (topic, message) => {
    handleLocalBusMessage(topic, message.toString()).catch((err) =>
      console.error('local handler:', err.message)
    );
  });
}

function localPublish(topic, payload, opts = {}) {
  if (!localReady) return Promise.resolve(); // drop silently; devices re-sync via retain/replay
  return new Promise((resolve) => {
    local.publish(topic, JSON.stringify(payload), { qos: 1, ...opts }, () => resolve());
  });
}

async function announceGatewayPresence() {
  await localPublish(`${LOCAL_PREFIX}/gateway/online`, {
    gateway_id: CONFIG.clientId,
    store_id: CONFIG.storeId,
    ts: Date.now(),
  }, { qos: 0 });
}

/** Push cached lighting + audio state onto the bus so devices converge after any reboot. */
async function replayCachedState() {
  try {
    const zones = await dbAll('SELECT * FROM led_state', []);
    for (const z of zones) {
      await localPublish(
        `${LOCAL_PREFIX}/rgb/${z.zone_id}/set`,
        {
          colour: z.colour,
          secondary: z.secondary,
          mode: z.mode,
          brightness: z.brightness,
          speed: z.speed,
          ...(z.segments ? { segments: JSON.parse(z.segments) } : {}),
          restored: true,
        },
        { qos: 0 }
      );
    }
    const audio = await dbAll('SELECT * FROM audio_state WHERE status != "stopped"', []);
    for (const a of audio) {
      await localPublish(`${LOCAL_PREFIX}/audio/${a.zone}/set`, {
        action: 'restore', playlist_id: a.playlist_id, volume: a.volume, source: a.source,
      }, { qos: 0 });
    }
    if (zones.length || audio.length) console.log(`♻️  Replayed state for ${zones.length} zones, ${audio.length} audio zones`);
  } catch (err) {
    console.error('state replay:', err.message);
  }
}

connectLocal();

// ─── Cloud Message Handler ───────────────────────────────────────────────
async function handleCloudMessage(topic, messageStr) {
  let payload;
  try {
    payload = JSON.parse(messageStr);
  } catch {
    return;
  }
  const commandId = payload.command_id || `gw_${Date.now().toString(36)}`;

  console.log(`📨 ${topic}`);

  // PRD §21.2 idempotency — duplicates are acked but not re-applied.
  if (await isDuplicateCommand(commandId)) {
    ackUpstream(commandId, `gateway-${CONFIG.storeId}`, 'duplicate');
    return;
  }

  await dbRun('INSERT INTO command_log (command_id, type, payload, status) VALUES (?, ?, ?, ?)', [
    commandId, topic, messageStr.slice(0, 4000), 'received',
  ]);

  try {
    // NOTE: spotify checks MUST come before the generic /audio/ match.
    if (topic.includes('/audio/spotify/')) {
      await forwardSpotifyCommand(topic, payload);
    } else if (topic.includes('/rgb/set/') || topic.endsWith('/rgb/set')) {
      await handleRgbCommand(payload, topic);
    } else if (topic.includes('/content/playlist') || topic.includes('/content/diff')) {
      await handleContentPlaylist(payload);
    } else if (topic.includes('/content/command')) {
      await handleContentCommand(payload);
    } else if (topic.includes('/audio/announce')) {
      await handleAudioAnnounce(payload);
    } else if (topic.includes('/audio/playlist')) {
      await handleAudioPlaylist(payload);
    } else if (topic.includes('/audio/set/') || topic.endsWith('/audio/set')) {
      await handleAudioCommand(payload, topic);
    } else if (topic.includes('/sync/transform')) {
      await handleSyncTransform(payload, commandId);
    } else if (topic.includes('/firmware/install')) {
      await handleFirmwareInstall(payload);
    } else {
      return; // unknown — leave dedupe untouched so a future version can handle it
    }

    await markCommandSeen(commandId);
    await dbRun('UPDATE command_log SET status = ? WHERE command_id = ?', ['executed', commandId]);
    ackUpstream(commandId, `gateway-${CONFIG.storeId}`, 'executed');
  } catch (err) {
    console.error(`command ${commandId} failed:`, err.message);
    await dbRun('UPDATE command_log SET status = ? WHERE command_id = ?', ['failed', commandId]);
    ackUpstream(commandId, `gateway-${CONFIG.storeId}`, 'failed', err.message.slice(0, 200));
  }
}

// ─── RGB ──────────────────────────────────────────────────────────────────
async function handleRgbCommand(payload, topic) {
  const match = topic.match(/rgb\/set\/([^/?]+)/);
  const zone = match ? match[1] : payload.zone || 'all';

  const colour = payload.colour || payload.primary || '#1B2A4A';
  const secondary = payload.secondary || null;
  const brightness = typeof payload.brightness === 'number' ? payload.brightness : 0.85;
  const mode = payload.mode || 'solid';
  const speed = payload.speed || 1.0;
  const segments = Array.isArray(payload.segments) ? payload.segments : undefined;

  const targets = zone === 'all' ? await knownZones() : [zone];

  for (const z of targets) {
    await dbRun(
      `INSERT OR REPLACE INTO led_state (zone_id, colour, secondary, brightness, mode, speed, segments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [z, colour, secondary, brightness, mode, speed, segments ? JSON.stringify(segments) : null]
    );
    // Retained → devices that reboot (or join later) get current state instantly.
    await localPublish(
      `${LOCAL_PREFIX}/rgb/${z}/set`,
      { command_id: payload.command_id, zone: z, colour, secondary, mode, brightness, speed, fade_ms: payload.fade_ms ?? 0, segments },
      { retain: true }
    );
  }
  console.log(`🎨 RGB ${colour}/${mode} → zones: ${targets.join(', ')}`);
}

async function knownZones() {
  const rows = await dbAll('SELECT DISTINCT zone_id FROM led_state', []);
  if (rows.length > 0) return rows.map((r) => r.zone_id);
  // First boot before any state exists — broadcast topic reaches every controller.
  return ['all'];
}

// ─── Content / Kiosks ─────────────────────────────────────────────────────
async function handleContentPlaylist(payload) {
  const playlistId = payload.playlist_id || payload.preset_id || null;
  const screens = Array.isArray(payload.screens) && payload.screens.length > 0 ? payload.screens : ['all'];

  for (const screenId of screens) {
    await dbRun('INSERT OR REPLACE INTO content_manifest (screen_id, hash, playlist_id, last_sync) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))', [
      screenId, payload.hash || '', playlistId,
    ]);
    await localPublish(
      `${LOCAL_PREFIX}/content/${screenId}/command`,
      { command_id: payload.command_id, cmd: 'set_playlist', playlist_id: playlistId, items: payload.items, hash: payload.hash },
      { retain: true }
    );
  }
  console.log(`📺 Playlist ${playlistId} → screens: ${screens.join(', ')}`);
}

/**
 * Device-level kiosk commands from routers/content.ts screenCommand /
 * pushAsset / emergencyMessage / clearOverlays:
 *   cmd ∈ set_playlist | push_asset | show_emergency | clear_overlay |
 *         reload | set_brightness | reboot | screenshot
 */
async function handleContentCommand(payload) {
  const targetScreens = Array.isArray(payload.screen_ids) && payload.screen_ids.length > 0
    ? payload.screen_ids
    : await registeredScreens();

  for (const screenId of targetScreens.length > 0 ? targetScreens : ['all']) {
    await localPublish(`${LOCAL_PREFIX}/content/${screenId}/command`, {
      command_id: payload.command_id, ...payload,
    });
  }
  console.log(`🖥️  content/${payload.cmd} → ${targetScreens.join(', ') || 'all'}`);
}

async function registeredScreens() {
  const rows = await dbAll("SELECT entity_ref FROM device_registry WHERE device_type = 'screen_player' AND status = 'online'", []);
  return rows.map((r) => r.entity_ref).filter(Boolean);
}

// ─── Audio ────────────────────────────────────────────────────────────────
async function handleAudioCommand(payload, topic) {
  const match = topic.match(/audio\/set\/([^/?]+)/);
  const zone = match ? match[1] : payload.zone || 'dining';

  await dbRun(
    `INSERT OR REPLACE INTO audio_state (zone, playlist_id, volume, status, source)
     VALUES (?, ?, ?, ?, ?)`,
    [zone, payload.playlist_id || null, payload.volume ?? 0.5, payload.action || 'play', payload.source || 'local']
  );

  await localPublish(
    `${LOCAL_PREFIX}/audio/${zone}/set`,
    {
      command_id: payload.command_id,
      action: payload.action || 'play',
      playlist_id: payload.playlist_id,
      volume: payload.volume,
      fade_ms: payload.fade_ms ?? 0,
      source: payload.source || 'local',
      stream_url: payload.stream_url,
    },
    { retain: false }
  );
  console.log(`🔊 Audio ${payload.action} → ${zone}`);
}

async function handleAudioAnnounce(payload) {
  await localPublish(`${LOCAL_PREFIX}/audio/announce`, payload);
  console.log(`📢 Announce queued (${Array.isArray(payload.zones) ? payload.zones.join(',') : 'dining'})`);
}

async function handleAudioPlaylist(payload) {
  await localPublish(`${LOCAL_PREFIX}/audio/playlist`, payload);
  console.log(`🎶 Audio playlist ${payload.playlist_id} pushed`);
}

async function forwardSpotifyCommand(topic, payload) {
  const action = topic.endsWith('/play') ? 'play' : 'pause';
  await localPublish(`${LOCAL_PREFIX}/audio/spotify/${action}`, {
    command_id: payload.command_id, playlist_uri: payload.playlist_uri, position_ms: payload.position_ms,
  });
  console.log(`🎵 Spotify ${action}`);
}

// ─── Sync Transform (legacy one-button path — decompose to components) ───
async function handleSyncTransform(payload, commandId) {
  const components = payload.components || { rgb: true, content: true, audio: true };
  const fadeMs = payload.fade_duration_ms ?? 3000;

  if (components.rgb) {
    await handleRgbCommand({
      command_id: commandId,
      colour: payload.rgb?.primary || payload.colour || '#FFD100',
      secondary: payload.rgb?.secondary,
      mode: payload.rgb?.mode || 'solid',
      brightness: payload.rgb?.brightness ?? 0.85,
      fade_ms: fadeMs,
    }, `${CLOUD_PREFIX}/store/x/rgb/set/all`);
  }
  if (components.content && payload.content?.playlist_id) {
    await handleContentPlaylist({ ...payload, playlist_id: payload.content.playlist_id, screens: payload.content.screens });
  }
  if (components.audio && payload.audio?.playlist_id) {
    await handleAudioCommand({
      command_id: commandId,
      action: 'play',
      zone: 'dining',
      playlist_id: payload.audio.playlist_id,
      volume: payload.audio.volume ?? 0.45,
      fade_ms: fadeMs,
    }, `${CLOUD_PREFIX}/store/x/audio/set/dining`);
  }
  console.log('🔄 Sync transform decomposed');
}

// ─── Firmware fan-out ──────────────────────────────────────────────────────
async function handleFirmwareInstall(payload) {
  await localPublish(`${LOCAL_PREFIX}/firmware/install`, payload);
  console.log(`📦 firmware/install v${payload.version} (${payload.device_class}) fanned out`);
}

// ─── Local bus → cloud relays ──────────────────────────────────────────────
const lastRelayByDevice = new Map();
const RELAY_THROTTLE_MS = 55_000;

async function handleLocalBusMessage(topic, messageStr) {
  let body;
  try {
    body = JSON.parse(messageStr);
  } catch {
    return;
  }
  const parts = topic.split('/'); // chromacommand/local/...

  // Device lifecycle
  if (parts[3] === 'device') {
    const event = parts[4];
    if (event === 'register' || event === 'heartbeat') {
      await upsertDevice(body, event === 'register' ? true : undefined);
      relayHeartbeat(body);
    } else if (event === 'offline') {
      await dbRun("UPDATE device_registry SET status = 'offline' WHERE device_id = ?", [body.device_id]);
      console.log(`🔌 LWT offline: ${body.device_id}`);
    }
    return;
  }

  // Command acknowledgements from individual devices
  if (parts[3] === 'command' && parts[4] === 'ack') {
    if (body.command_id && cloud.connected) {
      await publishUpstream(
        `${CLOUD_PREFIX}/store/${CONFIG.storeId}/command/ack`,
        { ...body, ts: body.ts || Date.now() },
        1
      ).catch(() => {});
    }
    return;
  }

  // OTA results from devices
  if (parts[3] === 'firmware' && parts[4] === 'state') {
    if (cloud.connected) {
      await publishUpstream(`${CLOUD_PREFIX}/store/${CONFIG.storeId}/firmware/state`, { ...body, ts: Date.now() }, 1).catch(() => {});
    }
    return;
  }

  // State reports
  if (parts[3] === 'state') {
    const kind = parts[4];
    const entity = parts[5];
    if (!cloud.connected) return;
    if (kind === 'rgb' && entity) {
      await publishUpstream(`${CLOUD_PREFIX}/store/${CONFIG.storeId}/rgb/state/${entity}`, body, 0).catch(() => {});
    } else if (kind === 'audio' && entity) {
      await publishUpstream(`${CLOUD_PREFIX}/store/${CONFIG.storeId}/audio/state/${entity}`, body, 0).catch(() => {});
    } else if (kind === 'content' && entity) {
      await publishUpstream(`${CLOUD_PREFIX}/store/${CONFIG.storeId}/content/state`, { screen_id: entity, ...body }, 0).catch(() => {});
    }
    return;
  }
}

async function upsertDevice(body, isRegister) {
  if (!body.device_id) return;
  await dbRun(
    `INSERT INTO device_registry (device_id, device_type, entity_ref, version, ip, status, last_seen)
     VALUES (?, ?, ?, ?, ?, 'online', strftime('%s','now'))
     ON CONFLICT(device_id) DO UPDATE SET
       device_type = COALESCE(excluded.device_type, device_type),
       entity_ref = COALESCE(excluded.entity_ref, entity_ref),
       version = COALESCE(excluded.version, version),
       ip = COALESCE(excluded.ip, ip),
       status = 'online',
       last_seen = strftime('%s','now')`,
    [body.device_id, body.device_type || null, body.entity_ref || null, body.version || null, body.ip || null]
  );
  if (isRegister) console.log(`🆔 Registered ${body.device_type}: ${body.device_id}`);
}

function relayHeartbeat(body) {
  if (!body.device_id || !cloud.connected) return;
  const last = lastRelayByDevice.get(body.device_id) || 0;
  const now = Date.now();
  if (now - last < RELAY_THROTTLE_MS) return;
  lastRelayByDevice.set(body.device_id, now);
  publishUpstream(
    `${CLOUD_PREFIX}/store/${CONFIG.storeId}/telemetry/heartbeat`,
    {
      device_id: body.device_id,
      device_type: body.device_type || 'unknown',
      entity_ref: body.entity_ref,
      store_id: CONFIG.storeId,
      ts: now,
      ip: body.ip || null,
      version: body.version || null,
    },
    0
  ).catch(() => {});
}

// ─── Gateway heartbeat ─────────────────────────────────────────────────────
function localIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (!cloud.connected) return;
    publishUpstream(
      `${CLOUD_PREFIX}/store/${CONFIG.storeId}/telemetry/heartbeat`,
      {
        device_id: `gateway-${CONFIG.storeId}`,
        device_type: 'gateway',
        store_id: CONFIG.storeId,
        ts: Date.now(),
        ip: localIp(),
        version: '2.0.0',
        uptime_s: Math.floor(process.uptime()),
      },
      0
    ).catch(() => {});
  }, CONFIG.heartbeatInterval);
}

// ─── Local REST API (techs + sensors) ─────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    storeId: CONFIG.storeId,
    cloudConnected: cloud.connected,
    localBusReady: localReady,
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/api/v1/zones', (req, res) => {
  db.all('SELECT * FROM led_state', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/v1/devices', (req, res) => {
  db.all('SELECT * FROM device_registry ORDER BY last_seen DESC', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/v1/content/:screenId/manifest', (req, res) => {
  db.get('SELECT * FROM content_manifest WHERE screen_id = ?', [req.params.screenId], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || { screen_id: req.params.screenId, hash: '', playlist_id: null });
  });
});

app.post('/api/v1/sensors/ingest', async (req, res) => {
  const { sensor_id, metric, value, recorded_at } = req.body || {};
  if (!sensor_id || !metric || typeof value !== 'number') {
    return res.status(400).json({ error: 'sensor_id, metric, value required' });
  }
  const recAt = recorded_at ? Math.floor(new Date(recorded_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
  await dbRun('INSERT INTO sensor_buffer (sensor_id, metric, value, recorded_at) VALUES (?, ?, ?, ?)', [
    sensor_id, metric, value, recAt,
  ]);
  res.json({ buffered: true });
});

const httpServer = app.listen(5000, () => {
  console.log('🔌 Local REST API on http://localhost:5000');
});

// ─── Sensor flush — marks sent ONLY after the broker accepts the publish ──
async function publishSensorBatch() {
  const rows = await dbAll(
    'SELECT id, sensor_id, metric, value, recorded_at FROM sensor_buffer WHERE sent = 0 ORDER BY id LIMIT 500'
  );
  if (rows.length === 0) return;
  const samples = rows.map((r) => ({
    sensor_id: r.sensor_id,
    metric: r.metric,
    value: r.value,
    recorded_at: new Date(r.recorded_at * 1000).toISOString(),
  }));
  await new Promise((resolve, reject) => {
    cloud.publish(
      `${CLOUD_PREFIX}/store/${CONFIG.storeId}/telemetry/sensors`,
      JSON.stringify({ samples }),
      { qos: 1 },
      (err) => (err ? reject(err) : resolve())
    );
  });
  const ids = rows.map((r) => r.id);
  await dbRun(`UPDATE sensor_buffer SET sent = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  await dbRun('DELETE FROM sensor_buffer WHERE sent = 1 AND recorded_at < ?', [Math.floor(Date.now() / 1000) - 86_400]);
  console.log(`📤 Flushed ${samples.length} telemetry samples`);
}

setInterval(() => {
  if (cloud.connected) publishSensorBatch().catch((err) => console.error('sensor flush:', err.message));
}, 60_000);

// ─── Graceful Shutdown ────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  db.close();
  if (local) local.end(true);
  cloud.end(false, () => httpServer.close());
  setTimeout(() => process.exit(0), 1500);
});

console.log(`🚀 Edge Gateway v2 starting for store: ${CONFIG.storeId}`);
console.log(`   Cloud broker : ${CONFIG.cloudBrokerUrl} (clean=false)`);
console.log(`   Local bus    : ${CONFIG.localBrokerUrl}`);
console.log(`   Local API    : http://localhost:5000`);
