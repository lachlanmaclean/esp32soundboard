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
  WaitingForVoice,
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

void enterWaitingForVoice() {
  state = State::WaitingForVoice;
  lastPollAt = millis();
  uiShowStatus("Almost there", "Join a voice channel to see your sounds");
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
    if (board.inVoiceChannel) {
      enterBoard();
    } else {
      enterWaitingForVoice();
    }
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

  const bool contentChanged = fresh.version != board.version || fresh.count != board.count;
  board = fresh;

  if (!board.inVoiceChannel) {
    if (state != State::WaitingForVoice) enterWaitingForVoice();
    return;
  }

  if (state != State::Board || contentChanged) {
    enterBoard();
  }
}

const char *apiResultName(ApiResult result) {
  switch (result) {
    case ApiResult::Ok: return "Ok";
    case ApiResult::NotPaired: return "NotPaired";
    case ApiResult::NotFound: return "NotFound";
    case ApiResult::NetworkError: return "NetworkError";
    case ApiResult::ServerError: return "ServerError";
    case ApiResult::ParseError: return "ParseError";
  }
  return "Unknown";
}

void handleTouch() {
  int32_t x = 0;
  int32_t y = 0;
  if (!display.getTouch(&x, &y)) return;

  const uint32_t now = millis();
  if (now - lastTouchAt < kTouchDebounceMs) return;
  lastTouchAt = now;

  const int index = uiButtonAt(board, x, y);
  Serial.printf("[touch] x=%d y=%d -> button %d\n", x, y, index);
  if (index < 0) return;

  // Draw the pressed state before making any network call, so it's instant
  // rather than waiting on the round trip to the server.
  uiPressButton(board, index);

  const ApiResult result = triggerSound(board.buttons[index].id);
  Serial.printf("[touch] trigger '%s' -> %s\n", board.buttons[index].name.c_str(), apiResultName(result));

  uiFinishButton(board, index, result != ApiResult::Ok);
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

    case State::WaitingForVoice:
      // Poll at the faster pairing cadence here, not the config interval -
      // this screen only shows while waiting on the user to do something,
      // so it should notice quickly once they join a voice channel.
      if (now - lastPollAt >= kPairPollIntervalMs) pollConfig();
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
