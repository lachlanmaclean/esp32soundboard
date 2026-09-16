#pragma once

#include <Arduino.h>
#include "config.h"

struct SoundButton {
  String id;
  String name;
  uint32_t color;  // 0xRRGGBB
};

struct BoardConfig {
  SoundButton buttons[kMaxButtons];
  size_t count = 0;
  int64_t version = -1;
};

enum class ApiResult {
  Ok,
  NotPaired,   // server knows the device but nobody has claimed it
  NotFound,    // server has never seen this device
  NetworkError,
  ServerError,
  ParseError,
};

/** Stable per-board id derived from the ESP32's factory MAC. */
const String &deviceCuid();

/** URL encoded into the pairing QR code. */
String pairingUrl(const String &pairingCode);

/**
 * Checks in with the server. Sets `paired` if a user has claimed this device,
 * otherwise fills `pairingCode` with the code to display.
 */
ApiResult registerDevice(bool &paired, String &pairingCode);

ApiResult fetchConfig(BoardConfig &out);

ApiResult triggerSound(const String &soundId);
