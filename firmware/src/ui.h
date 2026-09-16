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

/** Draws a button in its pressed state immediately on touch, before any network call. */
void uiPressButton(const BoardConfig &config, int index);

/** Shows the trigger's result briefly, then restores the button to normal. */
void uiFinishButton(const BoardConfig &config, int index, bool failed);
