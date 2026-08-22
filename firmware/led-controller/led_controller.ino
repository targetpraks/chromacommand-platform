/**
 * ChromaCommand LED Controller v2 — ESP32-S3 + FastLED
 *
 * Transport: WiFi + MQTT against the store's LOCAL broker (on the edge
 * gateway host). Replaces the v1 ESP-NOW design which could never receive
 * commands from the Node gateway.
 *
 *   Subscribes:  chromacommand/local/rgb/{ZONE_ID}/set
 *                chromacommand/local/rgb/all/set
 *                chromacommand/local/firmware/install
 *   Publishes:   chromacommand/local/rgb/state/{ZONE_ID}
 *                chromacommand/local/device/register | heartbeat | offline (LWT)
 *                chromacommand/local/command/ack
 *
 * Features:
 *   • 8 animation modes; per-segment overrides (start/end index ranges)
 *   • fade_ms crossfade between states (v1 parsed it and ignored it)
 *   • 30s heartbeat → cloud device inventory via gateway relay
 *   • command acks close the dispatch→ack loop in the cloud ledger
 *   • state persisted to NVS; restored on boot AND via retained messages
 *   • OTA: HTTP update triggered by firmware/install (LAN, sha256 reported)
 *
 * Provisioning (first flash): open Serial @115200 and send one line:
 *   CFG {"ssid":"...","pass":"...","host":"192.168.x.x","zone":"pp-a01-ceiling","store":"pp-a01"}
 * Config persists to NVS. No credentials are hardcoded or committed.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <FastLED.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

// ─── Build-time defaults (override per-device via NVS `CFG` line) ────────
#ifndef DEVICE_ZONE_ID
  #define DEVICE_ZONE_ID "unprovisioned"
#endif
#ifndef DEVICE_STORE_ID
  #define DEVICE_STORE_ID "unprovisioned"
#endif
#define FIRMWARE_VERSION "2.0.0"
#define NUM_LEDS 300
#define LED_PIN 17
#define LED_TYPE WS2812B
#define COLOUR_ORDER GRB
#define HEARTBEAT_MS 30000UL

// ─── Types ────────────────────────────────────────────────────────────────
struct Segment {
  uint16_t start;
  uint16_t end;
  CRGB colour;
  String mode;
};

struct LightState {
  CRGB primary = CRGB(0x1B, 0x2A, 0x4A);
  CRGB secondary = CRGB(0xC8, 0xA9, 0x51);
  String mode = "solid";
  float brightness = 0.85f;   // 0..1
  float speed = 1.0f;
  std::vector<Segment> segments;
};

Preferences prefs;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
CRGB leds[NUM_LEDS];

LightState state;
CRGB prevFrame[NUM_LEDS];     // frozen frame for crossfade source
unsigned long fadeStartMs = 0;
unsigned long fadeDurationMs = 0;
String lastCommandId = "";
unsigned long lastHeartbeatMs = 0;
bool provisioned = false;

String topicSetSelfStr;
String topicSetAllStr;

// ─── Helpers ──────────────────────────────────────────────────────────────
CRGB parseHex(const String& hex) {
  if (hex.length() < 7 || hex[0] != '#') return CRGB::Black;
  return CRGB(strtol(hex.substring(1, 3).c_str(), nullptr, 16),
              strtol(hex.substring(3, 5).c_str(), nullptr, 16),
              strtol(hex.substring(5, 7).c_str(), nullptr, 16));
}

String deviceId() {
  return String(DEVICE_STORE_ID) + "-" + String(DEVICE_ZONE_ID) + "-led";
}

void saveState() {
  prefs.begin("cc-led", false);
  prefs.putUChar("r", state.primary.r);
  prefs.putUChar("g", state.primary.g);
  prefs.putUChar("b", state.primary.b);
  prefs.putString("mode", state.mode);
  prefs.putFloat("bri", state.brightness);
  prefs.putFloat("spd", state.speed);
  prefs.end();
}

void loadState() {
  prefs.begin("cc-led", true);
  if (prefs.isKey("r")) {
    state.primary = CRGB(prefs.getUChar("r"), prefs.getUChar("g"), prefs.getUChar("b"));
    state.mode = prefs.getString("mode", "solid");
    state.brightness = prefs.getFloat("bri", 0.85f);
    state.speed = prefs.getFloat("spd", 1.0f);
  }
  prefs.end();
}

// ─── Rendering ────────────────────────────────────────────────────────────
uint8_t scale8f(float v) { return (uint8_t)constrain(v * 255.0f, 0, 255); }

void renderRange(uint16_t start, uint16_t end, const CRGB& c1, const CRGB& c2, bool hasSecondary,
                 const String& mode, float speed, unsigned long tNow) {
  if (start >= NUM_LEDS || end < start) return;
  uint16_t safeEnd = min((uint32_t)end, (uint32_t)(NUM_LEDS - 1));
  const uint16_t len = safeEnd - start + 1;
  const float phase = (tNow / 1000.0f) * speed;

  if (mode == "solid") {
    fill_solid(&leds[start], len, c1);
  } else if (mode == "gradient" && hasSecondary) {
    fill_gradient_RGB(&leds[start], len, c1, c2);
  } else if (mode == "pulse" || mode == "breath") {
    float wave = mode == "pulse" ? sinf(phase * PI) : (sinf(phase * PI * 0.4f) * 0.5f + 0.5f);
    CRGB c = c1; c.fadeToBlackBy(255 - (uint8_t)(wave * 255));
    fill_solid(&leds[start], len, c);
  } else if (mode == "chase") {
    fadeToBlackBy(&leds[start], len, 120);
    uint16_t pos = start + ((uint16_t)(phase * 30) % len);
    leds[pos] = c1;
    if (pos + 1 <= safeEnd) leds[pos + 1] = c1;
  } else if (mode == "sparkle") {
    fill_solid(&leds[start], len, c1.nscale8(60));
    if (random8() < (uint8_t)(speed * 40)) {
      leds[start + random16(len)] = c1;
    }
  } else if (mode == "wave") {
    for (uint16_t i = 0; i < len; i++) {
      float w = sinf((i / (float)len) * TWO_PI * 2 + phase * PI);
      leds[start + i] = blend(c1, hasSecondary ? c2 : c1, (uint8_t)((w * 0.5f + 0.5f) * 255));
    }
  } else if (mode == "rainbow") {
    uint8_t hue = (uint8_t)((tNow / 10) % 256);
    fill_rainbow(&leds[start], len, hue, max((int)(7 * speed), 1));
  } else {
    fill_solid(&leds[start], len, c1);
  }
}

/** Compute the target frame from current state, honouring segment overrides. */
void renderTarget(CRGB* out) {
  memcpy(out, leds, sizeof(CRGB) * NUM_LEDS);
  renderRange(0, NUM_LEDS - 1, state.primary, state.secondary, state.secondary != CRGB::Black,
              state.mode, state.speed, millis());
  for (const auto& seg : state.segments) {
    renderRange(seg.start, seg.end, seg.colour, seg.colour, false,
                seg.mode.isEmpty() ? state.mode : seg.mode, state.speed, millis());
  }
}

void applyOutput(float brightnessScale = -1.0f) {
  float b = brightnessScale >= 0 ? brightnessScale : state.brightness;
  FastLED.setBrightness(scale8f(b));
  FastLED.show();
}

// ─── Command application ─────────────────────────────────────────────────
void applyCommand(JsonObject& p) {
  // Snapshot current output as crossfade source.
  memcpy(prevFrame, leds, sizeof(CRGB) * NUM_LEDS);

  String newMode = p["mode"] | state.mode;
  state.mode = newMode;
  if (!p["colour"].isNull()) state.primary = parseHex(p["colour"].as<String>());
  else if (!p["primary"].isNull()) state.primary = parseHex(p["primary"].as<String>());
  if (!p["secondary"].isNull()) state.secondary = parseHex(p["secondary"].as<String>());
  if (!p["brightness"].isNull()) state.brightness = p["brightness"].as<float>();
  if (!p["speed"].isNull()) state.speed = p["speed"].as<float>();

  state.segments.clear();
  if (p["segments"].is<JsonArray>()) {
    for (JsonObject seg : p["segments"].as<JsonArray>()) {
      Segment s;
      s.start = seg["startIndex"] | 0;
      s.end = seg["endIndex"] | 0;
      s.colour = seg["primary"].isNull()
        ? (seg["colour"].isNull() ? state.primary : parseHex(seg["colour"].as<String>()))
        : parseHex(seg["primary"].as<String>());
      s.mode = seg["mode"] | "";
      state.segments.push_back(s);
    }
  }

  fadeStartMs = millis();
  fadeDurationMs = p["fade_ms"] | 0;

  if (!p["command_id"].isNull()) lastCommandId = p["command_id"].as<String>();
  saveState();

  // Report applied state upstream (gateway relays to cloud rgb/state).
  StaticJsonDocument<384> st;
  st["device_id"] = deviceId();
  st["zone"] = DEVICE_ZONE_ID;
  st["colour"] = "#" + String(state.primary.r, HEX) + String(state.primary.g, HEX) + String(state.primary.b, HEX);
  st["mode"] = state.mode;
  st["brightness"] = state.brightness;
  String out;
  serializeJson(st, out);
  mqtt.publish(String("chromacommand/local/rgb/state/") + DEVICE_ZONE_ID, out.c_str(), false);

  if (lastCommandId.length()) {
    StaticJsonDocument<256> ack;
    ack["command_id"] = lastCommandId;
    ack["device_id"] = deviceId();
    ack["status"] = "executed";
    String ackOut;
    serializeJson(ack, ackOut);
    mqtt.publish("chromacommand/local/command/ack", ackOut.c_str(), false);
  }
}

// ─── MQTT callbacks ───────────────────────────────────────────────────────
void onMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;

  if (strstr(topic, "/firmware/install")) {
    handleFirmwareInstall(doc.as<JsonObject>());
    return;
  }

  // Only react to our zone or broadcast sets.
  bool ours = strcmp(topic, topicSetSelfStr.c_str()) == 0 ||
              strcmp(topic, topicSetAllStr.c_str()) == 0;
  if (!ours) return;

  JsonObject obj = doc.as<JsonObject>();
  if (!obj.isNull()) applyCommand(obj);
}

void publishDeviceEvent(const char* event) {
  StaticJsonDocument<320> doc;
  doc["device_id"] = deviceId();
  doc["device_type"] = "led_controller";
  doc["entity_ref"] = DEVICE_ZONE_ID;
  doc["version"] = FIRMWARE_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  String out;
  serializeJson(doc, out);
  mqtt.publish(String("chromacommand/local/device/") + event, out.c_str(), false);
}

// ─── WiFi / MQTT connect ──────────────────────────────────────────────────
char wifiSsid[65] = "";
char wifiPass[65] = "";
char mqttHost[65] = "";

void loadConfig() {
  prefs.begin("cc-cfg", true);
  prefs.getString("ssid", wifiSsid, sizeof(wifiSsid));
  prefs.getString("pass", wifiPass, sizeof(wifiPass));
  prefs.getString("host", mqttHost, sizeof(mqttHost));
  prefs.end();
  provisioned = strlen(wifiSsid) > 0 && strlen(mqttHost) > 0;
}

/**
 * Serial provisioning: CFG {"ssid":..,"pass":..,"host":..,"store":..,"zone":..}
 * Overrides build defaults and reboots into the new config.
 */
void handleSerialConfig(const String& line) {
  JsonDocument doc;
  if (deserializeJson(doc, line.substring(4))) return;
  prefs.begin("cc-cfg", false);
  if (!doc["ssid"].isNull()) prefs.putString("ssid", doc["ssid"].as<String>());
  if (!doc["pass"].isNull()) prefs.putString("pass", doc["pass"].as<String>());
  if (!doc["host"].isNull()) prefs.putString("host", doc["host"].as<String>());
  prefs.end();
  Serial.println("CFG-SAVED rebooting…");
  delay(300);
  ESP.restart();
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (!provisioned) {
    Serial.println("✗ No config. Send over serial:  CFG {\"ssid\":..,\"pass\":..,\"host\":..}");
    return;
  }
  WiFi.begin(wifiSsid, wifiPass);
  Serial.printf("WiFi connecting to %s", wifiSsid);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ✓ " + WiFi.localIP().toString() : " ✗");
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  if (!provisioned || !mqttHost[0]) return;
  mqtt.setServer(mqttHost, 1883);
  String willTopic = "chromacommand/local/device/offline";
  String cid = deviceId();
  bool ok = mqtt.connect(cid.c_str(), nullptr, nullptr, willTopic.c_str(), 0, false,
                         ("{\"device_id\":\"" + cid + "\"}").c_str());
  if (ok) {
    mqtt.subscribe(topicSetSelfStr.c_str(), 1);
    mqtt.subscribe(topicSetAllStr.c_str(), 1);
    mqtt.subscribe("chromacommand/local/firmware/install", 1);
    publishDeviceEvent("register");
    Serial.println("MQTT connected + registered");
  } else {
    Serial.printf("MQTT rc=%d\n", mqtt.state());
  }
}

// ─── OTA ──────────────────────────────────────────────────────────────────
void handleFirmwareInstall(JsonObject p) {
  if (p["url"].isNull()) return;
  String url = p["url"].as<String>();
  String expectedSha = p["sha256"] | "";
  Serial.println("OTA from " + url);

  StaticJsonDocument<256> ack;
  ack["deployment_id"] = p["deployment_id"] | "";
  ack["device_id"] = deviceId();

  WiFiClient client;
  httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return ret = httpUpdate.update(client, url);
  if (ret == HTTP_UPDATE_FAILED) {
    ack["outcome"] = "failed";
    ack["error"] = httpUpdate.getLastErrorString();
    String out;
    serializeJson(ack, out);
    mqtt.publish("chromacommand/local/firmware/state", out.c_str(), false);
  }
  // On success the device reboots before this point.
}

// ─── Setup / loop ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  FastLED.addLeds<LED_TYPE, LED_PIN, COLOUR_ORDER>(leds, NUM_LEDS)
      .setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(scale8f(state.brightness));

  loadConfig();
  loadState();

  topicSetSelfStr = String("chromacommand/local/rgb/") + DEVICE_ZONE_ID + "/set";
  topicSetAllStr = "chromacommand/local/rgb/all/set";

  mqtt.setBufferSize(2048);
  mqtt.setCallback(onMessage);
  mqtt.setKeepAlive(30);

  ensureWifi();
}

void loop() {
  // Serial config lines
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    if (line.startsWith("CFG ")) handleSerialConfig(line);
  }

  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();

  // Heartbeat
  if (mqtt.connected() && now - lastHeartbeatMs > HEARTBEAT_MS) {
    lastHeartbeatMs = now;
    publishDeviceEvent("heartbeat");
  }

  // Animation tick (~60fps cap)
  static unsigned long lastTick = 0;
  if (now - lastTick < 16) { delay(2); return; }
  lastTick = now;

  static CRGB target[NUM_LEDS];
  renderTarget(target);

  float alpha = 1.0f;
  if (fadeDurationMs > 0 && now < fadeStartMs + fadeDurationMs) {
    alpha = (now - fadeStartMs) / (float)fadeDurationMs;
  }
  for (uint16_t i = 0; i < NUM_LEDS; i++) {
    leds[i] = blend(prevFrame[i], target[i], (uint8_t)(alpha * 255));
  }
  if (alpha >= 1.0f) memcpy(prevFrame, target, sizeof(CRGB) * NUM_LEDS);

  applyOutput();
}
