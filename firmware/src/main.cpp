#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>

#include "api.h"
#include "config.h"
#include "display.h"
#include "ui.h"

namespace {

enum class State {
  Connecting,
  Pairing,
  Board,
  Retrying,
};

State state = State::Connecting;
BoardConfig board;
String pairingCode;

uint32_t lastPollAt = 0;
uint32_t lastTouchAt = 0;

/** Captive portal SSID, unique per board so several can be set up at once. */
String setupApName() {
  const String cuid = deviceCuid();
  return "Gooseboard-" + cuid.substring(cuid.length() - 4);
}

void enterPairing(const String &code) {
  state = State::Pairing;
  pairingCode = code;
  lastPollAt = millis();
  uiShowPairing(code);
}

void enterBoard() {
  state = State::Board;
  lastPollAt = millis();
  uiShowBoard(board);
}

/** Shows a message and lets the main loop retry the check-in shortly after. */
void enterRetry(const char *title, const String &detail) {
  state = State::Retrying;
  lastPollAt = millis();
  uiShowStatus(title, detail);
}

/** Check in with the server and move to whichever screen matches its answer. */
void checkIn() {
  bool paired = false;
  String code;

  if (registerDevice(paired, code) != ApiResult::Ok) {
    enterRetry("Can't reach server", "Retrying...");
    return;
  }

  if (!paired) {
    // Redraw only when the code actually changes, so the screen doesn't
    // flicker on every poll.
    if (state == State::Pairing && code == pairingCode) {
      lastPollAt = millis();
    } else {
      enterPairing(code);
    }
    return;
  }

  const ApiResult configResult = fetchConfig(board);

  if (configResult == ApiResult::Ok) {
    enterBoard();
  } else if (configResult == ApiResult::NotPaired || configResult == ApiResult::NotFound) {
    // Unpaired in the gap between the two calls; the next check-in issues a
    // fresh code and drops us back into onboarding.
    enterRetry("Not paired", "Getting a pairing code...");
  } else {
    enterRetry("Can't reach server", "Retrying...");
  }
}

void pollConfig() {
  BoardConfig fresh;
  const ApiResult result = fetchConfig(fresh);
  lastPollAt = millis();

  if (result == ApiResult::NotPaired || result == ApiResult::NotFound) {
    // Unbinding is silent from the device's side: just go back to pairing.
    checkIn();
    return;
  }

  if (result != ApiResult::Ok) return;  // transient; keep showing what we have

  if (fresh.version != board.version || fresh.count != board.count) {
    board = fresh;
    uiShowBoard(board);
  }
}

void handleTouch() {
  int32_t x = 0;
  int32_t y = 0;
  if (!display.getTouch(&x, &y)) return;

  const uint32_t now = millis();
  if (now - lastTouchAt < kTouchDebounceMs) return;
  lastTouchAt = now;

  const int index = uiButtonAt(board, x, y);
  if (index < 0) return;

  const ApiResult result = triggerSound(board.buttons[index].id);
  uiFlashButton(board, index, result != ApiResult::Ok);
}

}  // namespace

void setup() {
  Serial.begin(115200);

  uiBegin();
  uiShowStatus("Gooseboard", "Starting up...");

  Serial.printf("[gooseboard] device id %s\n", deviceCuid().c_str());

  WiFiManager wifiManager;
  wifiManager.setConfigPortalTimeout(kSetupPortalTimeoutSec);
  wifiManager.setAPCallback([](WiFiManager *manager) {
    uiShowSetupPortal(manager->getConfigPortalSSID());
  });

  uiShowStatus("Gooseboard", "Connecting to Wi-Fi...");

  if (!wifiManager.autoConnect(setupApName().c_str(), kSetupApPassword)) {
    uiShowStatus("Wi-Fi failed", "Restarting...");
    delay(2000);
    ESP.restart();
  }

  Serial.printf("[gooseboard] wifi connected, ip %s\n", WiFi.localIP().toString().c_str());
  uiShowStatus("Gooseboard", "Checking in...");
  checkIn();
}

void loop() {
  const uint32_t now = millis();

  switch (state) {
    case State::Board:
      handleTouch();
      if (now - lastPollAt >= kConfigPollIntervalMs) pollConfig();
      break;

    case State::Pairing:
    case State::Retrying:
      if (now - lastPollAt >= kPairPollIntervalMs) checkIn();
      break;

    case State::Connecting:
      break;
  }

  delay(20);
}
