/**
 * ChromaCommand Edge Gateway — MQTT Client for ThinkCentre Tiny M90q
 * Bridges cloud MQTT broker to local ESP-NOW mesh (LED controllers)
 * Also manages screen players and audio nodes via local MQTT
 */

const mqtt = require('mqtt');
const sqlite3 = require('sqlite3').verbose();
const { WebSocketServer } = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Configuration ────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  regionId: process.env.REGION_ID || 'cape-town',
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtts://broker.chromacommand.io:8883',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  clientId: `edge-${process.env.STORE_ID || 'pp-a01'}-${Date.now()}`,
  dbPath: process.env.DB_PATH || './edge_cache.db',
  localMqttPort: parseInt(process.env.LOCAL_MQTT_PORT || '1883'),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  syncInterval: parseInt(process.env.SYNC_INTERVAL || '60000'),
};

// ─── SQLite Local Cache ──────────────────────────────────────────────────
const db = new sqlite3.Database(CONFIG.dbPath, (err) => {
  if (err) console.error('SQLite error:', err);
  else console.log('📦 Local cache initialised');
});

// Setup tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS led_state (
      zone_id TEXT PRIMARY KEY,
      colour TEXT DEFAULT '#1B2A4A',
      secondary TEXT DEFAULT '#C8A951',
      brightness INTEGER DEFAULT 217,
      mode TEXT DEFAULT 'solid',
      speed REAL DEFAULT 1.0,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS command_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id TEXT,
      type TEXT,
      payload TEXT,
      status TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
});

// ─── MQTT Cloud Client ────────────────────────────────────────────────────
const mqttOptions = {
  clientId: CONFIG.clientId,
  username: CONFIG.mqttUsername,
  password: CONFIG.mqttPassword,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  protocol: 'mqtts',
  rejectUnauthorized: true,
};

const cloudClient = mqtt.connect(CONFIG.mqttBrokerUrl, mqttOptions);

cloudClient.on('connect', () => {
  console.log('☁️  Connected to cloud MQTT broker');
  
  // Subscribe to store-specific topics
  const topics = [
    `chromacommand/store/${CONFIG.storeId}/rgb/set/+`,
    `chromacommand/store/${CONFIG.storeId}/rgb/schedule`,
    `chromacommand/store/${CONFIG.storeId}/content/playlist`,
    `chromacommand/store/${CONFIG.storeId}/content/diff`,
    `chromacommand/store/${CONFIG.storeId}/audio/set/+`,
    `chromacommand/store/${CONFIG.storeId}/audio/announce`,
    `chromacommand/store/${CONFIG.storeId}/sync/transform`,
    `chromacommand/global/rgb/set`,
    `chromacommand/global/content/set`,
    `chromacommand/global/audio/set`,
    `chromacommand/region/${CONFIG.regionId}/rgb/set`,
    `chromacommand/region/${CONFIG.regionId}/content/set`,
  ];
  
  cloudClient.subscribe(topics, (err) => {
    if (err) console.error('Subscribe error:', err);
    else console.log('📡 Subscribed to', topics.length, 'topics');
  });
  
  // Start heartbeat
  startHeartbeat();
});

cloudClient.on('message', (topic, message) => {
  handleCloudMessage(topic, message.toString());
});

cloudClient.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

cloudClient.on('disconnect', () => {
  console.log('☁️  Disconnected from cloud — running offline mode');
});

// ─── Local Express + WebSocket Server ──────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', storeId: CONFIG.storeId, uptime: process.uptime() });
});

// Local REST endpoint for LED zones (used by ESP-NOW bridge)
app.get('/api/v1/zones', (req, res) => {
  db.all('SELECT * FROM led_state', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/v1/content/:screenId/manifest', (req, res) => {
  const screenId = req.params.screenId;
  db.get('SELECT * FROM content_manifest WHERE screen_id = ?', [screenId], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || { screen_id: screenId, hash: '', playlist_id: null });
  });
});

const httpServer = app.listen(5000, () => {
  console.log('🔌 Local REST API on http://localhost:5000');
});

// ─── WebSocket for real-time dashboard (screen players + LED controllers) ─
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = `ws_${Date.now()}`;
  clients.set(clientId, ws);
  console.log(`🔌 WS client connected: ${clientId}`);
  
  ws.on('message', (data) => {
    handleLocalMessage(JSON.parse(data.toString()));
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`🔌 WS client disconnected: ${clientId}`);
  });
});

// ─── Cloud Message Handler ───────────────────────────────────────────────
async function handleCloudMessage(topic, messageStr) {
  try {
    const payload = JSON.parse(messageStr);
    const commandId = payload.command_id || `local_${Date.now()}`;
    
    console.log(`📨 ${topic}:`, payload.command || payload.type || 'unknown');
    
    // Log command
    db.run(
      'INSERT INTO command_log (command_id, type, payload, status) VALUES (?, ?, ?, ?)',
      [commandId, topic, messageStr, 'received']
    );
    
    if (topic.includes('/rgb/set/')) {
      await handleRgbCommand(payload, commandId, topic);
    } else if (topic.includes('/content/')) {
      await handleContentCommand(payload, commandId);
    } else if (topic.includes('/audio/')) {
      await handleAudioCommand(payload, commandId);
    } else if (topic.includes('/sync/transform')) {
      await handleSyncTransform(payload, commandId);
    }
    
    // Update status
    db.run('UPDATE command_log SET status = ? WHERE command_id = ?', ['executed', commandId]);
    
    // Send ACK to cloud
    cloudClient.publish(
      `chromacommand/store/${CONFIG.storeId}/command/ack`,
      JSON.stringify({ command_id: commandId, status: 'executed', timestamp: Date.now() })
    );
    
  } catch (err) {
    console.error('Message handler error:', err.message);
  }
}

// ─── RGB Command Handler ─────────────────────────────────────────────────
async function handleRgbCommand(payload, commandId, topic) {
  const zoneMatch = topic.match(/rgb\/set\/(.+)/);
  const zone = zoneMatch ? zoneMatch[1] : 'all';
  
  // Update local cache
  const colour = payload.colour || payload.primary || '#1B2A4A';
  const secondary = payload.secondary || '#C8A951';
  const brightness = Math.round((payload.brightness || 0.85) * 255);
  const mode = payload.mode || 'solid';
  const speed = payload.speed || 1.0;
  
  const zonesToUpdate = zone === 'all' ? await getAllZones() : [zone];
  
  for (const z of zonesToUpdate) {
    db.run(
      `INSERT OR REPLACE INTO led_state (zone_id, colour, secondary, brightness, mode, speed) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [z, colour, secondary, brightness, mode, speed]
    );
    
    // Broadcast to ESP-NOW layer (via local WS to ESP-NOW bridge)
    broadcastToLocalClients({
      type: 'rgb',
      zone: z,
      cmd: 'set_colour',
      primary: colour,
      secondary: secondary,
      brightness: brightness / 255,
      mode: mode,
      speed: speed,
      fade_ms: payload.fade_ms || 2000,
    });
  }
  
  console.log(`🎨 RGB set for zones: ${zonesToUpdate.join(', ')}`);
}

function getAllZones() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT zone_id FROM led_state', [], (err, rows) => {
      if (err) reject(err);
      else {
        const zones = rows.map(r => r.zone_id);
        if (zones.length === 0) {
          // Default zones for new store
          resolve(['ceiling', 'window', 'undercounter', 'counter-front', 'pickup', 'signage']);
        } else {
          resolve(zones);
        }
      }
    });
  });
}

// ─── Content Command Handler ─────────────────────────────────────────────
async function handleContentCommand(payload, commandId) {
  const playlist = payload.playlist || payload;
  const screens = playlist.screens || ['menu-primary', 'menu-combo', 'promo-board'];
  
  for (const screenId of screens) {
    db.run(
      'INSERT OR REPLACE INTO content_manifest (screen_id, hash, playlist_id) VALUES (?, ?, ?)',
      [screenId, payload.hash || '', playlist.playlist_id]
    );
  }
  
  // Forward to screen players via local WS
  broadcastToLocalClients({
    type: 'content',
    cmd: 'set_playlist',
    playlist: playlist,
    screens: screens,
  });
  
  console.log(`📺 Content set for screens: ${screens.join(', ')}`);
}

// ─── Audio Command Handler ───────────────────────────────────────────────
async function handleAudioCommand(payload, commandId) {
  const zone = payload.zone || 'dining';
  
  db.run(
    'INSERT OR REPLACE INTO audio_state (zone, playlist_id, volume, status) VALUES (?, ?, ?, ?)',
    [zone, payload.playlist_id, payload.volume || 0.5, payload.action || 'play']
  );
  
  // Forward to audio player via local WS
  broadcastToLocalClients({
    type: 'audio',
    cmd: payload.cmd || payload.action || 'play',
    zone: zone,
    playlist_id: payload.playlist_id,
    volume: payload.volume || 0.5,
    fade_ms: payload.fade_ms || 2000,
  });
  
  console.log(`🔊 Audio ${payload.action} for zone: ${zone}`);
}

// ─── Sync Transform Handler (One-Button TakeOver) ────────────────────────
async function handleSyncTransform(payload, commandId) {
  const components = payload.components || { rgb: true, content: true, audio: true };
  const fadeMs = payload.fade_duration_ms || 3000;
  
  console.log(`🔄 Sync transform starting (${fadeMs}ms fade)...`);
  
  const promises = [];
  
  if (components.rgb) {
    promises.push(handleRgbCommand({
      primary: payload.rgb?.primary || '#FFD100',
      secondary: payload.rgb?.secondary || '#CBA135',
      mode: payload.rgb?.mode || 'solid',
      brightness: payload.rgb?.brightness || 0.85,
      fade_ms: fadeMs,
    }, commandId, `chromacommand/store/${CONFIG.storeId}/rgb/set/all`));
  }
  
  if (components.content) {
    promises.push(handleContentCommand({
      playlist_id: payload.content?.playlist_id,
      screens: payload.content?.screens,
    }, commandId));
  }
  
  if (components.audio) {
    promises.push(handleAudioCommand({
      action: 'play',
      zone: 'dining',
      playlist_id: payload.audio?.playlist_id,
      volume: payload.audio?.volume || 0.45,
      fade_ms: fadeMs,
    }, commandId));
  }
  
  await Promise.all(promises);
  console.log('✅ Sync transform complete');
}

// ─── Local Message Handler ─────────────────────────────────────────────────
function handleLocalMessage(message) {
  // Handle messages from local devices (ESP32, screen players, audio nodes)
  if (message.type === 'heartbeat') {
    // Device heartbeat — update status
    console.log(`💓 Heartbeat from ${message.device_type}: ${message.device_id}`);
  } else if (message.type === 'ack') {
    console.log(`✅ ACK from ${message.device_id}: ${message.status}`);
  }
}

// ─── Broadcast to Local WS Clients ────────────────────────────────────────
function broadcastToLocalClients(message) {
  const msgStr = JSON.stringify(message);
  for (const [id, ws] of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(msgStr);
    }
  }
}

// ─── Heartbeat ─────────────────────────────────────────────────────────────
function startHeartbeat() {
  setInterval(() => {
    const status = {
      store_id: CONFIG.storeId,
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0',
      devices: {
        led_zones: 0, // TODO: count from DB
        screens: 0,
        audio_zones: 0,
      }
    };
    
    db.all('SELECT COUNT(*) as count FROM led_state', [], (err, rows) => {
      if (!err) status.devices.led_zones = rows[0].count;
      
      cloudClient.publish(
        `chromacommand/store/${CONFIG.storeId}/telemetry/heartbeat`,
        JSON.stringify(status)
      );
    });
  }, CONFIG.heartbeatInterval);
}

// ─── Sync Scheduler (Periodically sync with cloud) ────────────────────────
setInterval(() => {
  // If disconnected, this won't run until reconnection
  if (!cloudClient.connected) return;
  
  // Request any pending diffs from cloud
  cloudClient.publish(
    `chromacommand/store/${CONFIG.storeId}/sync/request`,
    JSON.stringify({ store_id: CONFIG.storeId, timestamp: Date.now() })
  );
}, CONFIG.syncInterval);

// ─── Graceful Shutdown ────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  db.close();
  cloudClient.end();
  httpServer.close();
  process.exit(0);
});

console.log(`🚀 Edge Gateway starting for store: ${CONFIG.storeId}`);
console.log(`   MQTT Broker: ${CONFIG.mqttBrokerUrl}`);
console.log(`   Local API: http://localhost:5000`);
console.log(`   Heartbeat: every ${CONFIG.heartbeatInterval}ms`);
console.log(`   Sync: every ${CONFIG.syncInterval}ms`);
