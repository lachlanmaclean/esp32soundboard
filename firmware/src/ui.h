#pragma once

#include "api.h"

void uiBegin();

/** Full-screen status message, used for booting/Wi-Fi/error states. */
void uiShowStatus(const char *title, const String &detail);

/** Wi-Fi setup instructions while the captive portal is running. */
void uiShowSetupPortal(const String &apName);

/** Pairing code plus a QR code pointing at the portal's /pair page. */
void uiShowPairing(const String &pairingCode);

void uiShowBoard(const BoardConfig &config);

/** Index of the button at the given screen coordinates, or -1. */
int uiButtonAt(const BoardConfig &config, int x, int y);

/** Draws a button in its pressed state - call the instant a finger touches down on it. */
void uiPressButton(const BoardConfig &config, int index);

/** Restores a button to normal - call the instant a finger lifts off it, independent of any network call. */
void uiReleaseButton(const BoardConfig &config, int index);

/** Briefly flashes a button red to report a failed trigger, whenever that result arrives. */
void uiFlashError(const BoardConfig &config, int index);
