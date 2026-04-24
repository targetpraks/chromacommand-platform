/**
 * ChromaCommand LED Controller — ESP32-S3 Firmware
 * Controls WS2812B / APA102 LED strips via ESP-NOW mesh + WiFi
 * Receives colour commands from Edge Gateway, drives LEDs with FastLED
 */

#include <FastLED.h>
#include <WiFi.h>
#include <esp_now.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ─── Configuration (customise per zone) ────────────────────────────────────
#define ZONE_ID        "ceiling"        // Change per controller: ceiling, window, counter, pickup, sign, etc.
#define STORE_ID       "pp-a01"
#define LED_PIN        2              // GPIO for WS2812B data
#define LED_COUNT      300            // Number of LEDs on this strip
#define LED_TYPE       WS2812B        // WS2812B, APA102, SK6812
#define COLOR_ORDER    GRB            // GRB for WS2812B, RGB for APA102
#define BRIGHTNESS_PIN 25             // PWM pin for brightness (optional, or software)

// ESP-NOW peer (Edge Gateway MAC — will be discovered or set via config)
uint8_t gatewayMac[6] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00};

// ─── FastLED Setup ─────────────────────────────────────────────────────────
CRGB leds[LED_COUNT];

// ─── Current State ─────────────────────────────────────────────────────────
struct LedState {
  CRGB colour;
  CRGB secondaryColour;
  uint8_t brightness;
  uint8_t mode;        // 0=solid, 1=gradient, 2=pulse, 3=chase, 4=breath, 5=sparkle, 6=wave, 7=rainbow
  float speed;
  uint16_t fadeMs;
  unsigned long lastUpdate;
  bool active;
};

LedState currentState = {
  .colour = CRGB::Navy,
  .secondaryColour = CRGB::Gold,
  .brightness = 217,  // 0.85 * 255
  .mode = 0,
  .speed = 1.0,
  .fadeMs = 2000,
  .lastUpdate = 0,
  .active = true
};

// ─── Animation Variables ───────────────────────────────────────────────────
float animPhase = 0.0;
unsigned long animStart = 0;

// ─── WiFi Configuration ────────────────────────────────────────────────────
const char* wifiSSID     = "PapaPasta_IoT";
const char* wifiPassword = "PastaIoT2026!";

// ─── Preferences (persistent storage) ────────────────────────────────────
Preferences prefs;

// ─── ESP-NOW RX Callback ───────────────────────────────────────────────────
void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  char jsonBuffer[512];
  if (len >= 512) len = 511;
  memcpy(jsonBuffer, incomingData, len);
  jsonBuffer[len] = '\0';

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonBuffer);
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  const char* cmd = doc["cmd"] | "";
  if (strcmp(cmd, "set_colour") == 0) {
    // Parse colour command
    const char* primaryHex = doc["primary"] | "#1B2A4A";
    const char* secondaryHex = doc["secondary"] | "#C8A951";
    uint8_t brightness = (uint8_t)(doc["brightness"] | 0.85) * 255;
    const char* modeStr = doc["mode"] | "solid";
    float speed = doc["speed"] | 1.0;
    uint16_t fadeMs = doc["fade_ms"] | 2000;

    currentState.colour = parseHexColour(primaryHex);
    currentState.secondaryColour = parseHexColour(secondaryHex);
    currentState.brightness = brightness;
    currentState.speed = speed;
    currentState.fadeMs = fadeMs;
    currentState.mode = parseMode(modeStr);
    currentState.lastUpdate = millis();
    currentState.active = true;

    // Save to NVRAM
    prefs.begin("led_state", false);
    prefs.putString("colour", primaryHex);
    prefs.putString("secondary", secondaryHex);
    prefs.putUChar("brightness", brightness);
    prefs.putUChar("mode", currentState.mode);
    prefs.putFloat("speed", speed);
    prefs.putUInt("fade_ms", fadeMs);
    prefs.end();

    // Send ACK back to gateway
    sendAck("colour_set");
  }
}

// ─── ESP-NOW TX Callback ───────────────────────────────────────────────────
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  // ACK sent — can log if needed
}

// ─── Helpers ───────────────────────────────────────────────────────────────
CRGB parseHexColour(const char* hex) {
  long r = strtol(hex + 1, NULL, 16) >> 16;
  long g = (strtol(hex + 1, NULL, 16) >> 8) & 0xFF;
  long b = strtol(hex + 1, NULL, 16) & 0xFF;
  return CRGB(r, g, b);
}

uint8_t parseMode(const char* modeStr) {
  if (strcmp(modeStr, "solid") == 0) return 0;
  if (strcmp(modeStr, "gradient") == 0) return 1;
  if (strcmp(modeStr, "pulse") == 0) return 2;
  if (strcmp(modeStr, "chase") == 0) return 3;
  if (strcmp(modeStr, "breath") == 0) return 4;
  if (strcmp(modeStr, "sparkle") == 0) return 5;
  if (strcmp(modeStr, "wave") == 0) return 6;
  if (strcmp(modeStr, "rainbow") == 0) return 7;
  return 0;
}

void sendAck(const char* status) {
  StaticJsonDocument<256> doc;
  doc["type"] = "ack";
  doc["zone"] = ZONE_ID;
  doc["store"] = STORE_ID;
  doc["status"] = status;
  doc["timestamp"] = millis();
  char buffer[256];
  size_t len = serializeJson(doc, buffer);
  esp_now_send(gatewayMac, (uint8_t*)buffer, len);
}

// ─── Animation Engine ──────────────────────────────────────────────────────
void updateAnimation() {
  if (!currentState.active) return;

  unsigned long now = millis();
  float t = (now - currentState.lastUpdate) / 1000.0 * currentState.speed;
  animPhase += 0.01 * currentState.speed;
  if (animPhase > TWO_PI) animPhase -= TWO_PI;

  uint8_t brightness = currentState.brightness;

  switch (currentState.mode) {
    case 0: // SOLID
      fill_solid(leds, LED_COUNT, currentState.colour);
      break;

    case 1: // GRADIENT — Linear blend between primary and secondary
      for (int i = 0; i < LED_COUNT; i++) {
        float ratio = (float)i / (LED_COUNT - 1);
        leds[i] = blend(currentState.colour, currentState.secondaryColour, ratio * 255);
      }
      break;

    case 2: // PULSE — Brightness oscillates
      {
        float pulse = (sin(t * 2) + 1.0) / 2.0;
        uint8_t pulseBright = brightness * pulse;
        fill_solid(leds, LED_COUNT, currentState.colour);
        for (int i = 0; i < LED_COUNT; i++) {
          leds[i].nscale8(pulseBright);
        }
      }
      break;

    case 3: // CHASE — Dot moves along strip
      {
        fill_solid(leds, LED_COUNT, CRGB::Black);
        int pos = (int)(animPhase * 10) % LED_COUNT;
        leds[pos] = currentState.colour;
        leds[(pos + 1) % LED_COUNT] = currentState.colour;
        leds[(pos + 2) % LED_COUNT] = currentState.colour;
        fadeToBlackBy(leds, LED_COUNT, 20);
      }
      break;

    case 4: // BREATH — Slow fade in/out
      {
        float breath = (sin(t * 0.5) + 1.0) / 2.0;
        uint8_t breathBright = brightness * breath;
        fill_solid(leds, LED_COUNT, currentState.colour);
        for (int i = 0; i < LED_COUNT; i++) {
          leds[i].nscale8(breathBright);
        }
      }
      break;

    case 5: // SPARKLE — Random twinkling
      {
        fill_solid(leds, LED_COUNT, currentState.colour);
        leds[random16(LED_COUNT)] = currentState.secondaryColour;
        fadeToBlackBy(leds, LED_COUNT, 10);
      }
      break;

    case 6: // WAVE — Sine wave colour shift
      {
        for (int i = 0; i < LED_COUNT; i++) {
          float wave = (sin((float)i / LED_COUNT * TWO_PI + animPhase) + 1.0) / 2.0;
          leds[i] = blend(currentState.colour, currentState.secondaryColour, wave * 255);
        }
      }
      break;

    case 7: // RAINBOW — Full spectrum cycle
      {
        fill_rainbow(leds, LED_COUNT, (uint8_t)(animPhase * 40), 255 / LED_COUNT);
      }
      break;

    default:
      fill_solid(leds, LED_COUNT, currentState.colour);
      break;
  }

  FastLED.setBrightness(brightness);
  FastLED.show();
}

// ─── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n🟢 ChromaCommand LED Controller — Booting...");

  // Load persistent state
  prefs.begin("led_state", true);
  String savedColour = prefs.getString("colour", "#1B2A4A");
  String savedSecondary = prefs.getString("secondary", "#C8A951");
  currentState.colour = parseHexColour(savedColour.c_str());
  currentState.secondaryColour = parseHexColour(savedSecondary.c_str());
  currentState.brightness = prefs.getUChar("brightness", 217);
  currentState.mode = prefs.getUChar("mode", 0);
  currentState.speed = prefs.getFloat("speed", 1.0);
  currentState.fadeMs = prefs.getUInt("fade_ms", 2000);
  prefs.end();

  // WiFi init (for ESP-NOW, WiFi must be in STA mode)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());

  // ESP-NOW init
  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ ESP-NOW init failed!");
    return;
  }
  esp_now_register_recv_cb(OnDataRecv);
  esp_now_register_send_cb(OnDataSent);

  // Add peer (Edge Gateway)
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, gatewayMac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  // FastLED init
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, LED_COUNT);
  FastLED.setBrightness(currentState.brightness);
  FastLED.clear(true);

  Serial.println("✅ Ready — waiting for colour commands from Edge Gateway");
  
  // Restore last colour on boot
  fill_solid(leds, LED_COUNT, currentState.colour);
  FastLED.show();
}

// ─── Main Loop ──────────────────────────────────────────────────────────────
void loop() {
  updateAnimation();
  delay(16); // ~60 FPS
}
