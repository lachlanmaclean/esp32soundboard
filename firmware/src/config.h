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
// Ignore repeat touches within this window, so one press is one sound.
static constexpr uint32_t kTouchDebounceMs = 350;

static constexpr size_t kMaxButtons = 8;
