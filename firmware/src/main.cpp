#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <memory>

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

// Touch is edge-triggered (once per physical touch, not once per poll while
// held), and the network call runs on its own task so it can never delay
// the visual press/release - those track the finger directly.
bool touchWasDown = false;
int pressedIndex = -1;
uint32_t lastTouchEdgeAt = 0;

struct TriggerJob {
  String soundId;
  String name;
  int index;
};

struct TriggerOutcome {
  int index;
  bool success;
};

QueueHandle_t triggerOutcomes = nullptr;

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

/** Runs on its own task so a slow (or hung) network call never blocks touch handling. */
void triggerTask(void *param) {
  std::unique_ptr<TriggerJob> job(static_cast<TriggerJob *>(param));

  const ApiResult result = triggerSound(job->soundId);
  Serial.printf("[touch] trigger '%s' -> %s\n", job->name.c_str(), apiResultName(result));

  const TriggerOutcome outcome{job->index, result == ApiResult::Ok};
  xQueueSend(triggerOutcomes, &outcome, 0);

  vTaskDelete(nullptr);
}

/** Applies any trigger results that have come back since the last check. */
void drainTriggerOutcomes() {
  TriggerOutcome outcome;
  while (xQueueReceive(triggerOutcomes, &outcome, 0) == pdTRUE) {
    if (!outcome.success) uiFlashError(board, outcome.index);
  }
}

void handleTouch() {
  int32_t x = 0;
  int32_t y = 0;
  const bool isDown = display.getTouch(&x, &y);
  const uint32_t now = millis();

  if (isDown && !touchWasDown) {
    // Rising edge: finger just made contact. A short debounce here filters
    // contact-bounce noise, not deliberate re-taps (those need touch-up first).
    if (now - lastTouchEdgeAt < kTouchEdgeDebounceMs) return;
    lastTouchEdgeAt = now;
    touchWasDown = true;

    const int index = uiButtonAt(board, x, y);
    Serial.printf("[touch] down x=%d y=%d -> button %d\n", x, y, index);
    if (index < 0) return;

    pressedIndex = index;
    uiPressButton(board, index);

    auto *job = new TriggerJob{board.buttons[index].id, board.buttons[index].name, index};
    xTaskCreate(triggerTask, "trigger", 6144, job, 1, nullptr);
    return;
  }

  if (!isDown && touchWasDown) {
    // Falling edge: finger lifted. Release the visual state right away,
    // regardless of whether the background trigger has finished yet.
    touchWasDown = false;
    if (pressedIndex >= 0) {
      uiReleaseButton(board, pressedIndex);
      pressedIndex = -1;
    }
  }
}

}  // namespace

#ifdef GOOSEBOARD_CALIBRATE_TOUCH
/**
 * Measures this exact panel's touch calibration interactively and prints it
 * in a form to paste into kTouchCalibration (config.h). Applies it live too,
 * so the rest of this boot (including the real button grid once paired) is
 * already usable for a sanity check before hardcoding anything.
 */
void runTouchCalibration() {
  static uint16_t calibration[8];

  display.fillScreen(TFT_BLACK);
  display.setTextColor(TFT_WHITE);
  display.setTextDatum(top_left);
  display.setCursor(8, 8);
  display.println("Tap each crosshair as it appears...");
  delay(1000);

  display.calibrateTouch(calibration, TFT_WHITE, TFT_BLACK, 20);
  display.setTouchCalibrate(calibration);

  Serial.println("[calib] Done. Paste this into kTouchCalibration in config.h:");
  Serial.print("static uint16_t kTouchCalibration[8] = {");
  for (int i = 0; i < 8; i++) {
    Serial.print(calibration[i]);
    if (i < 7) Serial.print(", ");
  }
  Serial.println("};");

  display.fillScreen(TFT_BLACK);
  display.setCursor(8, 8);
  display.println("Calibrated! Values on serial monitor.\n");
  for (int i = 0; i < 8; i++) {
    display.print(calibration[i]);
    display.print(i < 7 ? ", " : "\n");
  }
  display.println("\nContinuing in 5s to test taps live...");
  delay(5000);
}
#endif

void setup() {
  Serial.begin(115200);

  triggerOutcomes = xQueueCreate(4, sizeof(TriggerOutcome));

  uiBegin();

#ifdef GOOSEBOARD_CALIBRATE_TOUCH
  runTouchCalibration();
#endif

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
      drainTriggerOutcomes();
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
