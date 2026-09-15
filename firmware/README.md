# Gooseboard CYD Firmware

PlatformIO + LovyanGFX firmware for the ESP32 Cheap Yellow Display. Not yet
scaffolded — built after the bot + API + portal have a working pairing flow
to test against.

Planned structure:
- `platformio.ini`
- `src/main.cpp`
- `src/wifi_onboarding.*` — WiFiManager (tzapu) captive portal
- `src/pairing_screen.*` — pairing code + QR code display (ESP_QRcode)
- `src/button_grid.*` — LovyanGFX sound button UI
- `src/api_client.*` — register/pair polling, config fetch, trigger webhook
