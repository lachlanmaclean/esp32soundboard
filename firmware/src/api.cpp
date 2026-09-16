#include "api.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace {

const String kApiBase = GOOSEBOARD_API_BASE;

bool isHttps() { return kApiBase.startsWith("https://"); }

/**
 * Certificates aren't pinned: the device talks to one known host over TLS and
 * carries no secrets beyond its own id, and keeping a CA bundle current on a
 * device with no UI is its own maintenance problem. Traffic is still
 * encrypted, just not authenticated.
 *
 * One persistent client per caller, not a fresh one per call: paired with
 * http.setReuse(true) below, this lets consecutive requests to the same host
 * skip TLS's handshake entirely when the connection is still alive - a full
 * ESP32 TLS handshake alone commonly costs 1-3+ seconds, which was showing
 * up as every single button press hanging before the sound played.
 *
 * Two independent instances, not one shared between all three callers:
 * triggerSound() runs on its own FreeRTOS task so it can't block touch
 * handling, while registerDevice()/fetchConfig() run on the main loop task.
 * A WiFiClient isn't safe to use from two tasks at once, so each side needs
 * its own - otherwise a periodic config poll landing mid-trigger would race
 * on the same socket.
 */
WiFiClient &clientFor(WiFiClientSecure &secureClient, WiFiClient &plainClient, bool &secureInitialized) {
  if (!isHttps()) return plainClient;

  if (!secureInitialized) {
    secureClient.setInsecure();
    secureInitialized = true;
  }
  return secureClient;
}

/** Used only from the main loop task (registerDevice, fetchConfig). */
WiFiClient &mainThreadClient() {
  static WiFiClientSecure secureClient;
  static WiFiClient plainClient;
  static bool secureInitialized = false;
  return clientFor(secureClient, plainClient, secureInitialized);
}

/** Used only from the background trigger task. */
WiFiClient &triggerThreadClient() {
  static WiFiClientSecure secureClient;
  static WiFiClient plainClient;
  static bool secureInitialized = false;
  return clientFor(secureClient, plainClient, secureInitialized);
}

ApiResult statusToResult(int status) {
  if (status >= 200 && status < 300) return ApiResult::Ok;
  if (status == 404) return ApiResult::NotFound;
  if (status == 409) return ApiResult::NotPaired;
  if (status <= 0) return ApiResult::NetworkError;
  return ApiResult::ServerError;
}

/** "#RRGGBB" (or "RRGGBB") to 0xRRGGBB, falling back to Discord blurple. */
uint32_t parseHexColor(const char *value) {
  if (value == nullptr) return 0x5865F2;
  if (*value == '#') value++;

  char *end = nullptr;
  uint32_t parsed = strtoul(value, &end, 16);
  if (end == value) return 0x5865F2;
  return parsed & 0xFFFFFF;
}

}  // namespace

const String &deviceCuid() {
  static String cuid;
  if (cuid.length() == 0) {
    uint64_t mac = ESP.getEfuseMac();
    char buffer[20];
    snprintf(buffer, sizeof(buffer), "gb-%04x%08x", (uint16_t)(mac >> 32), (uint32_t)mac);
    cuid = buffer;
  }
  return cuid;
}

String pairingUrl(const String &pairingCode) {
  return String(GOOSEBOARD_PORTAL_BASE) + "/pair?code=" + pairingCode;
}

ApiResult registerDevice(bool &paired, String &pairingCode) {
  if (WiFi.status() != WL_CONNECTED) return ApiResult::NetworkError;

  HTTPClient http;
  http.setTimeout(10000);
  http.setReuse(true);

  if (!http.begin(mainThreadClient(), kApiBase + "/api/devices/register")) {
    return ApiResult::NetworkError;
  }
  http.addHeader("Content-Type", "application/json");

  JsonDocument request;
  request["cuid"] = deviceCuid();
  request["firmwareVersion"] = kFirmwareVersion;

  String body;
  serializeJson(request, body);

  const int status = http.POST(body);
  if (statusToResult(status) != ApiResult::Ok) {
    http.end();
    return statusToResult(status);
  }

  JsonDocument response;
  const DeserializationError error = deserializeJson(response, http.getStream());
  http.end();

  if (error) return ApiResult::ParseError;

  paired = response["paired"] | false;
  pairingCode = response["pairingCode"].isNull() ? "" : response["pairingCode"].as<String>();
  return ApiResult::Ok;
}

ApiResult fetchConfig(BoardConfig &out) {
  if (WiFi.status() != WL_CONNECTED) return ApiResult::NetworkError;

  HTTPClient http;
  http.setTimeout(10000);
  http.setReuse(true);

  if (!http.begin(mainThreadClient(), kApiBase + "/api/devices/" + deviceCuid() + "/config")) {
    return ApiResult::NetworkError;
  }

  const int status = http.GET();
  if (statusToResult(status) != ApiResult::Ok) {
    http.end();
    return statusToResult(status);
  }

  JsonDocument response;
  const DeserializationError error = deserializeJson(response, http.getStream());
  http.end();

  if (error) return ApiResult::ParseError;

  out.count = 0;
  out.version = response["version"] | 0;
  out.inVoiceChannel = response["inVoiceChannel"] | false;

  for (JsonObject button : response["buttons"].as<JsonArray>()) {
    if (out.count >= kMaxButtons) break;
    out.buttons[out.count].id = button["id"].as<String>();
    out.buttons[out.count].name = button["displayName"].as<String>();
    out.buttons[out.count].color = parseHexColor(button["color"]);
    out.count++;
  }

  return ApiResult::Ok;
}

ApiResult triggerSound(const String &soundId) {
  if (WiFi.status() != WL_CONNECTED) return ApiResult::NetworkError;

  // Each tap runs this on its own task so touch handling never blocks; if a
  // second tap lands before the first request finishes, both would otherwise
  // hit the same reused connection at once. Serializing here is free - a
  // near-simultaneous second tap just waits briefly for the first request to
  // finish, then reuses the same warm connection.
  static SemaphoreHandle_t mutex = xSemaphoreCreateMutex();
  xSemaphoreTake(mutex, portMAX_DELAY);

  HTTPClient http;
  http.setTimeout(8000);
  http.setReuse(true);

  if (!http.begin(triggerThreadClient(), kApiBase + "/api/devices/trigger")) {
    xSemaphoreGive(mutex);
    return ApiResult::NetworkError;
  }
  http.addHeader("Content-Type", "application/json");

  JsonDocument request;
  request["cuid"] = deviceCuid();
  request["soundId"] = soundId;

  String body;
  serializeJson(request, body);

  const int status = http.POST(body);
  const String responseBody = status > 0 ? http.getString() : String();
  http.end();

  xSemaphoreGive(mutex);

  Serial.printf("[api] POST /api/devices/trigger -> status %d, body: %s\n", status, responseBody.c_str());

  return statusToResult(status);
}
