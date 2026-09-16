# Gooseboard CYD Firmware

PlatformIO + LovyanGFX firmware for the ESP32 "Cheap Yellow Display". The
device is a dumb trigger: it never stores or plays audio, it just shows a grid
of buttons and tells the bot which sound to play.

Target board: **ESP32-2432S028R** — 2.8" 320x240 ILI9341 with a resistive
XPT2046 touch panel.

## Layout

- `platformio.ini` — board, dependencies, and the API/portal URLs
- `src/config.h` — timings and limits
- `src/display.h` — LovyanGFX pin mapping for the CYD
- `src/api.{h,cpp}` — register / poll config / trigger HTTP calls
- `src/ui.{h,cpp}` — status, pairing (code + QR), and button-grid screens
- `src/main.cpp` — Wi-Fi onboarding and the screen state machine

## Build and flash

```bash
cd firmware
pio run                 # build
pio run -t upload       # flash over USB
pio device monitor      # serial log at 115200
```

Set your own deployment's URLs in `platformio.ini` under `build_flags`:

```ini
-DGOOSEBOARD_API_BASE='"https://your-api-domain"'
-DGOOSEBOARD_PORTAL_BASE='"https://your-portal-domain"'
```

## How it behaves

1. **First boot** — no Wi-Fi saved, so it starts a captive portal. The screen
   shows the network name (`Gooseboard-XXXX`) and password (`gooseboard`);
   join it on a phone and pick your Wi-Fi in the page that opens.
2. **Check-in** — once online it POSTs its device id to `/api/devices/register`.
   The id is derived from the ESP32's factory MAC, so it's stable across
   reboots and there's nothing to persist locally.
3. **Pairing** — while unclaimed, it displays the server-issued pairing code
   and a QR code pointing at the portal's `/pair` page with the code already
   filled in. It re-checks every few seconds.
4. **Board** — once paired it fetches its sounds and draws the grid (up to 8,
   4x2). Tapping fires `/api/devices/trigger`; the tile flashes its colour on
   success, red on failure.
5. **Unpairing** — removing the device in the portal needs no action here. The
   next poll returns "not paired" and it drops back to the pairing screen as
   if new.

Config is polled every 15s. The server returns a `version` that changes when a
sound is edited, so the grid only redraws when something actually changed.

## Things to know

- **Touch calibration.** Resistive panels vary between units. The values in
  `src/display.h` are typical for this board; if taps land off-target, adjust
  `x_min`/`x_max`/`y_min`/`y_max` there.
- **Board revisions vary.** If the screen stays blank, the pin mapping in
  `src/display.h` is the first thing to check — some CYD variants ship an
  ST7789 panel instead of the ILI9341 assumed here.
- **Emoji icons don't render.** Sounds can carry an emoji icon in the portal,
  but the embedded fonts have no emoji glyphs, so tiles show the name and
  colour only.
- **TLS is unauthenticated.** The device encrypts traffic but doesn't verify
  the server's certificate (`setInsecure()`), because keeping a CA bundle
  current on a screen-only device is its own maintenance problem. It carries
  no credentials beyond its own device id.
- **No OTA.** The app uses the `huge_app` partition layout, trading the second
  app slot for flash headroom. Updates are over USB.
