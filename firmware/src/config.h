#pragma once

#include <Arduino.h>

#ifndef GOOSEBOARD_API_BASE
#define GOOSEBOARD_API_BASE "http://localhost:4000"
#endif

#ifndef GOOSEBOARD_PORTAL_BASE
#define GOOSEBOARD_PORTAL_BASE "http://localhost:3000"
#endif

static constexpr const char *kFirmwareVersion = "0.1.0";

// Wi-Fi captive portal shown on first boot (or after a failed connection).
static constexpr const char *kSetupApPassword = "gooseboard";
static constexpr uint32_t kSetupPortalTimeoutSec = 300;

// How often the device checks in while waiting to be paired.
static constexpr uint32_t kPairPollIntervalMs = 3000;
// How often a paired device re-fetches its sound config.
static constexpr uint32_t kConfigPollIntervalMs = 15000;
// Filters contact-bounce noise right at touch-down/up, not a rate limit on
// deliberate taps - presses are now edge-triggered (once per physical touch,
// however long it's held), so this only needs to be short.
static constexpr uint32_t kTouchEdgeDebounceMs = 40;

static constexpr size_t kMaxButtons = 8;

// Touch calibration for this exact panel, measured with the cyd_calibrate
// build (see platformio.ini) via LovyanGFX's calibrateTouch(). Re-run that
// build and replace these if the panel is ever swapped.
static uint16_t kTouchCalibration[8] = {3620, 360, 3594, 3714, 494, 382, 498, 3698};
