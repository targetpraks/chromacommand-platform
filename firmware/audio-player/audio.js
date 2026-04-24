/**
 * ChromaCommand Pi 5 Audio Player Node
 * MPD-based music player with MQTT control
 * Supports playlists, crossfade, ducking, TTS announcements
 */

const mqtt = require('mqtt');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── Configuration ────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  zone: process.env.AUDIO_ZONE || 'dining',
  mqttBroker: process.env.MQTT_BROKER_URL || 'mqtts://broker.chromacommand.io:8883',
  localGateway: process.env.EDGE_GATEWAY_URL || 'ws://localhost:5000/ws',
  cacheDir: process.env.AUDIO_CACHE_DIR || './audio_cache',
  playlistDir: process.env.AUDIO_PLAYLIST_DIR || './audio_cache/playlists',
};

// ─── MPD Control ──────────────────────────────────────────────────────────
class MPDController {
  constructor() {
    this.client = null;
    this.currentPlaylist = null;
    this.volume = 0.5;
    this.ducked = false;
  }

  // Using 'mpc' CLI for simplicity (Mopidy/MPD must be running)
  async command(cmd) {
    return new Promise((resolve, reject) => {
      exec(`mpc ${cmd}`, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
  }

  async loadPlaylist(playlistId) {
    console.log(`🔊 Loading playlist: ${playlistId}`);
    try {
      await this.command(`clear`);
      await this.command(`load ${playlistId}`);
      await this.command(`play`);
      this.currentPlaylist = playlistId;
    } catch (err) {
      console.error('MPD load error:', err.message);
    }
  }

  async setVolume(vol) {
    this.volume = vol;
    await this.command(`volume ${Math.round(vol * 100)}`);
  }

  async fadeVolume(target, durationMs) {
    const steps = 20;
    const stepMs = durationMs / steps;
    const startVol = this.volume;
    
    for (let i = 0; i <= steps; i++) {
      const newVol = startVol + (target - startVol) * (i / steps);
      await this.setVolume(newVol);
      await sleep(stepMs);
    }
  }

  async pause() {
    await this.command('pause');
  }

  async play() {
    await this.command('play');
  }

  async duck(durationMs = 5000) {
    if (this.ducked) return;
    this.ducked = true;
    const original = this.volume;
    await this.fadeVolume(0.15, 500);
    setTimeout(() => {
      this.fadeVolume(original, 500);
      this.ducked = false;
    }, durationMs);
  }

  async announce(text, voice = 'en-ZA-female-1', volume = 0.7) {
    await this.duck(8000);
    
    // Generate TTS using Piper (local) or fallback
    const ttsFile = path.join(CONFIG.cacheDir, `announce_${Date.now()}.wav`);
    
    try {
      // Try Piper TTS first
      await new Promise((resolve, reject) => {
        const proc = spawn('piper-tts', [
          '--model', 'en_ZA-...', // Path to Piper model
          '--output_file', ttsFile,
          text
        ]);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Piper TTS failed'));
        });
      });
    } catch (err) {
      // Fallback: use espeak or festival
      console.log('Piper failed, using fallback TTS');
      await new Promise((resolve, reject) => {
        exec(`espeak -w ${ttsFile} "${text}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Play announcement
    const originalVol = this.volume;
    await this.setVolume(volume);
    await new Promise((resolve, reject) => {
      exec(`aplay ${ttsFile}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await this.setVolume(originalVol);
    
    // Cleanup
    fs.unlink(ttsFile, () => {});
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── MQTT Client ──────────────────────────────────────────────────────────
const mqttOptions = {
  clientId: `audio-${CONFIG.storeId}-${CONFIG.zone}-${Date.now()}`,
  reconnectPeriod: 5000,
};

const client = mqtt.connect(CONFIG.mqttBroker, mqttOptions);
const mpd = new MPDController();

client.on('connect', () => {
  console.log(`🔊 Audio node connected: ${CONFIG.storeId}/${CONFIG.zone}`);
  
  client.subscribe([
    `chromacommand/store/${CONFIG.storeId}/audio/set/${CONFIG.zone}`,
    `chromacommand/store/${CONFIG.storeId}/audio/announce`,
  ]);
});

client.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    
    if (topic.includes('/audio/set/')) {
      handleAudioSet(payload);
    } else if (topic.includes('/audio/announce')) {
      await mpd.announce(payload.text, payload.voice, payload.volume);
    }
  } catch (err) {
    console.error('Audio handler error:', err.message);
  }
});

async function handleAudioSet(payload) {
  const action = payload.action || payload.cmd || 'play';
  
  switch (action) {
    case 'play':
      if (payload.playlist_id) {
        await mpd.loadPlaylist(payload.playlist_id);
      } else {
        await mpd.play();
      }
      if (payload.volume !== undefined) await mpd.fadeVolume(payload.volume, payload.fade_ms || 2000);
      break;
    case 'pause':
      await mpd.pause();
      break;
    case 'stop':
      await mpd.command('stop');
      break;
    case 'duck':
      await mpd.duck(payload.restore_after_ms || 5000);
      break;
    case 'skip':
      await mpd.command('next');
      break;
  }
  
  // ACK
  client.publish(
    `chromacommand/store/${CONFIG.storeId}/audio/state/${CONFIG.zone}`,
    JSON.stringify({
      zone: CONFIG.zone,
      action: action,
      playlist: mpd.currentPlaylist,
      volume: mpd.volume,
      timestamp: Date.now(),
    })
  );
}

console.log(`🎵 Audio player starting for ${CONFIG.storeId}/${CONFIG.zone}`);
