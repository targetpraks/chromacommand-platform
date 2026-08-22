/**
 * ChromaCommand Audio Player v2 — in-store audio node (Pi 5 + HiFiBerry)
 *
 * Transport: local MQTT on the edge gateway (v1 connected to the CLOUD
 * broker directly, which made the gateway double-execute every command).
 *
 *   Subscribes: chromacommand/local/audio/{ZONE}/set      (transport/volume)
 *               chromacommand/local/audio/announce        (TTS, broadcast)
 *               chromacommand/local/audio/playlist        (library push)
 *   Publishes:  device register/heartbeat/offline(LWT),
 *               chromacommand/local/command/ack,
 *               chromacommand/local/state/audio/{ZONE}
 *
 * Engines: MPD/mpc (local library), mpg123/ffplay (HTTP streams),
 * librespot (Spotify, optional). TTS: piper (model via PIPER_MODEL env)
 * with espeak fallback — invoked via execFile argv arrays only.
 *
 * Announcements run through a priority queue and duck music while playing
 * (v1 ignored zones[], duck_music and priority).
 *
 * Run on Pi: AUDIO_ZONE=dining STORE_ID=pp-a01 LOCAL_MQTT_URL=mqtt://<gw>:1883 node audio.js
 */

const mqtt = require('mqtt');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ─── Config ───────────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  zone: process.env.AUDIO_ZONE || 'dining',
  localMqttUrl: process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883',
  heartbeatMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
  piperModel: process.env.PIPER_MODEL || '',           // e.g. /usr/share/piper/en_ZA-lessac-medium.onnx
  piperBin: process.env.PIPER_BIN || 'piper',
  spotifyUser: process.env.SPOTIFY_USERNAME || '',
  spotifyPass: process.env.SPOTIFY_PASSWORD || '',
};

const FIRMWARE_VERSION = '2.0.0';
const deviceId = `${CONFIG.storeId}-${CONFIG.zone}-audio`;
const PREFIX = 'chromacommand/local';

// ─── State ────────────────────────────────────────────────────────────────
let client = null;
let volume = parseFloat(process.env.INITIAL_VOLUME || '0.5');
let muted = false;
let currentSource = 'local';       // local | stream | spotify
let currentPlaylistId = null;
let streamProcess = null;          // active mpg123/ffmpeg/librespot child
let fadeToken = 0;

// Announcement queue — higher priority first; FIFO within a priority.
const announceQueue = [];
let announcing = false;

// ─── Engine plumbing ──────────────────────────────────────────────────────
async function mpc(...args) {
  return execFileAsync('mpc', args).catch((err) => {
    throw new Error(`mpc ${args[0]} failed: ${(err.stderr || err.message || '').slice(0, 120)}`);
  });
}

function stopStreamProcess() {
  if (streamProcess) {
    streamProcess.kill('SIGTERM');
    streamProcess = null;
  }
}

/** Play an HTTP/ICY stream via mpg123 or ffplay. Resolves on exit. */
function playStream(url) {
  return new Promise((resolve, reject) => {
    const bin = ['mpg123', 'ffplay'].find((b) => require('fs').existsSync(`/usr/bin/${b}`) || true); // resolved via PATH below
    const cmdArgs = bin === 'ffplay' ? ['-nodisp', '-autoexit', '-loglevel', 'quiet', url] : [url];
    try {
      streamProcess = spawn(bin === 'ffplay' ? 'ffplay' : 'mpg123', cmdArgs, { stdio: 'ignore' });
    } catch (err) {
      return reject(new Error(`no stream player available (${err.message})`));
    }
    streamProcess.on('error', (err) => { streamProcess = null; reject(new Error(`stream player missing: ${err.message}`)); });
    streamProcess.on('exit', () => { streamProcess = null; resolve(); });
  });
}

async function playLocal(playlistId) {
  if (playlistId) {
    // Convention: MPD playlists are named after ChromaCommand playlist ids.
    await mpc('clear');
    await mpc('load', `cc-${playlistId}`).catch(async () => {
      await mpc('load', String(playlistId));
    });
  }
  await mpc('play');
}

async function setMpdVolume(percent) {
  await mpc('volume', String(Math.round(percent))).catch(() => {}); // non-fatal when engine != mpd
  // amixer drives the raw ALSA sink for stream/TTS paths.
  await execFileAsync('amixer', ['sset', 'Master', `${Math.round(percent)}%`, 'unmute']).catch(() => {});
}

// ── Volume + fades ────────────────────────────────────────────────────────
function effectiveVolume() {
  return muted ? 0 : volume;
}

/** Linear fade; cancellable by a later fade via token. */
async function fadeTo(targetPct, ms) {
  const token = ++fadeToken;
  const fromPct = effectiveVolume() * 100;
  const steps = Math.max(1, Math.min(40, Math.floor(ms / 25)));
  for (let i = 1; i <= steps; i++) {
    if (token !== fadeToken) return;
    const pct = fromPct + ((targetPct - fromPct) * i) / steps;
    await setMpdVolume(pct);
    await new Promise((r) => setTimeout(r, Math.floor(ms / steps)));
  }
  if (token === fadeToken) await setMpdVolume(targetPct);
}

// ── Announcements (priority queue + ducking) ──────────────────────────────
function enqueueAnnouncement(cmd) {
  announceQueue.push({ ...cmd, _queuedAt: Date.now() });
  announceQueue.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5) || a._queuedAt - b._queuedAt);
  processAnnounceQueue();
}

async function processAnnounceQueue() {
  if (announcing || announceQueue.length === 0) return;
  announcing = true;
  const job = announceQueue.shift();

  try {
    const myVolume = (job.volume ?? 0.7) * 100;
    const musicWas = effectiveVolume();

    if (job.duck_music !== false) await fadeTo(Math.max(musicWas * 0.15, 5), 500);
    await setMpdVolume(myVolume);

    await speak(job.text, job.voice);

    if (job.duck_music !== false) {
      await setMpdVolume(musicWas);
    }
    publishAck(job.command_id, 'executed');
  } catch (err) {
    console.error('announce:', err.message);
    publishAck(job.command_id, 'failed', err.message.slice(0, 160));
  } finally {
    announcing = false;
    setTimeout(processAnnounceQueue, 250);
  }
}

async function speak(text) {
  const wavFile = `/tmp/cc-announce-${Date.now()}.wav`;

  if (CONFIG.piperModel) {
    // Piper reads text on stdin, writes WAV. execFile argv — no shell interpolation.
    await new Promise((resolve, reject) => {
      const piper = spawn(CONFIG.piperBin, ['--model', CONFIG.piperModel, '--output_file', wavFile], { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = '';
      piper.stderr.on('data', (d) => { stderr += d; });
      piper.on('error', reject);
      piper.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.slice(0, 160)))));
      piper.stdin.end(text);
    });
  } else {
    await execFileAsync('espeak', ['-w', wavFile, '-v', 'en-za', text]).catch(() => {
      throw new Error('no TTS engine available (install piper or espeak)');
    });
  }

  await new Promise((resolve, reject) => {
    const play = spawn('aplay', [wavFile], { stdio: 'ignore' });
    play.on('error', reject);
    play.on('close', resolve);
  }).finally(() => {
    require('fs').unlink(wavFile, () => {});
  });
}

// ─── Command handling ─────────────────────────────────────────────────────
async function handleSet(cmd) {
  const action = cmd.action;
  const ack = (status, detail) =>
    publish(`${PREFIX}/command/ack`, { command_id: cmd.command_id, device_id: deviceId, status, detail });

  try {
    switch (action) {
      case 'play':
        currentPlaylistId = cmd.playlist_id || currentPlaylistId;
        currentSource = cmd.source === 'stream' && cmd.stream_url ? 'stream' : cmd.source || 'local';
        if (currentSource === 'stream') {
          stopStreamProcess();
          playStream(cmd.stream_url).catch((err) => console.error(err.message));
        } else if (currentSource === 'spotify') {
          startSpotifyIfConfigured();
        } else {
          await playLocal(currentPlaylistId);
        }
        break;

      case 'pause':
        if (currentSource === 'local') await mpc('pause');
        stopStreamProcess();
        break;

      case 'stop':
        if (currentSource === 'local') await mpc('stop').catch(() => {});
        stopStreamProcess();
        currentPlaylistId = null;
        break;

      case 'skip':
        if (currentSource === 'local') await mpc('next');
        break;

      case 'previous':
        if (currentSource === 'local') await mpc('prev');
        break;

      case 'volume':
        if (typeof cmd.volume === 'number') {
          volume = cmd.volume;
          muted = false;
          fadeTo(volume * 100, cmd.fade_ms ?? 300);
        }
        break;

      case 'mute':
        muted = true;
        fadeTo(0, 200);
        break;

      case 'unmute':
        muted = false;
        fadeTo(volume * 100, 200);
        break;

      case 'duck':
        fadeTo(effectiveVolume() * 100 * 0.15, 400);
        break;

      case 'unduck':
      case 'restore':
        fadeTo(volume * 100, 400);
        break;

      default:
        ack('failed', `unknown action ${action}`);
        return;
    }

    publishState(action);
    ack('executed');
  } catch (err) {
    console.error(`audio ${action}:`, err.message);
    publishState();
    ack('failed', err.message.slice(0, 160));
  }
}

function startSpotifyIfConfigured() {
  if (!CONFIG.spotifyUser) {
    console.warn('Spotify source requested but SPOTIFY_USERNAME not configured — skipping');
    return;
  }
  stopStreamProcess();
  streamProcess = spawn('librespot', [
    '--name', `papa-pasta-${CONFIG.storeId}`,
    '--backend', 'alsa',
    '--username', CONFIG.spotifyUser,
    '--password', CONFIG.spotifyPass,
    '--initial-volume', String(Math.round(volume * 100)),
    '--bitrate', '192',
  ], { stdio: 'ignore' });
  streamProcess.on('error', (err) => console.error('librespot:', err.message));
}

// ─── MQTT ─────────────────────────────────────────────────────────────────
function publish(topic, payload, opts = {}) {
  if (client && client.connected) client.publish(topic, JSON.stringify(payload), { qos: 1, ...opts });
}

function publishAck(commandId, status, detail) {
  if (!commandId) return;
  publish(`${PREFIX}/command/ack`, { command_id: commandId, device_id: deviceId, status, detail });
}

function publishState(action) {
  publish(`${PREFIX}/state/audio/${CONFIG.zone}`, {
    device_id: deviceId,
    zone: CONFIG.zone,
    status: action === 'stop' ? 'stopped' : action === 'pause' ? 'paused' : 'online',
    volume: effectiveVolume(),
    source: currentSource,
    playlist_id: currentPlaylistId,
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
    console.log(`🏠 audio node online — zone=${CONFIG.zone}`);
    publish(`${PREFIX}/device/register`, {
      device_id: deviceId,
      device_type: 'audio_player',
      entity_ref: `${CONFIG.storeId}-${CONFIG.zone}`,
      version: FIRMWARE_VERSION,
    });
    client.subscribe([
      `${PREFIX}/audio/${CONFIG.zone}/set`,
      `${PREFIX}/audio/announce`,
      `${PREFIX}/audio/playlist`,
    ], { qos: 1 });
    publishState('boot');
  });

  client.on('message', (topic, message) => {
    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch {
      return;
    }

    if (topic.endsWith('/announce')) {
      const zones = Array.isArray(msg.zones) && msg.zones.length > 0 ? msg.zones : ['dining'];
      if (!zones.includes(CONFIG.zone)) return; // v1 played every announcement everywhere
      enqueueAnnouncement(msg);
    } else if (topic.endsWith('/playlist')) {
      currentPlaylistId = msg.playlist_id || currentPlaylistId;
      handleSet({ ...msg, action: msg.action || 'play' });
    } else {
      handleSet(msg);
    }
  });

  client.on('error', (err) => console.error('mqtt:', err.message));

  setInterval(() => {
    publish(`${PREFIX}/device/heartbeat`, { device_id: deviceId, version: FIRMWARE_VERSION });
  }, CONFIG.heartbeatMs);
}

connect();
