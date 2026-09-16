#include "ui.h"

#include <qrcode.h>

#include <vector>

#include "display.h"

GooseboardDisplay display;

namespace {

constexpr int kScreenW = 320;
constexpr int kScreenH = 240;

constexpr int kMargin = 6;
constexpr int kGap = 6;
constexpr int kCols = 4;
constexpr int kRows = 2;
constexpr int kTileW = (kScreenW - (2 * kMargin) - ((kCols - 1) * kGap)) / kCols;
constexpr int kTileH = (kScreenH - (2 * kMargin) - ((kRows - 1) * kGap)) / kRows;

constexpr uint32_t kBgColor = 0x1E1F22;
constexpr uint32_t kTextColor = 0xF2F3F5;
constexpr uint32_t kMutedColor = 0x949BA4;

int tileX(int index) { return kMargin + (index % kCols) * (kTileW + kGap); }
int tileY(int index) { return kMargin + (index / kCols) * (kTileH + kGap); }

/** Darkened version of a colour, for tile fills that text stays readable on. */
uint32_t dim(uint32_t rgb, float factor) {
  const uint8_t r = (uint8_t)(((rgb >> 16) & 0xFF) * factor);
  const uint8_t g = (uint8_t)(((rgb >> 8) & 0xFF) * factor);
  const uint8_t b = (uint8_t)((rgb & 0xFF) * factor);
  return ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
}

/** Splits a label across up to two lines so longer names stay readable. */
void drawLabel(const String &text, int centerX, int centerY, int maxWidth) {
  display.setTextDatum(middle_center);

  const int approxCharW = 6;  // font 1 at size 1
  const size_t perLine = max(1, maxWidth / approxCharW);

  if (text.length() <= perLine) {
    display.drawString(text, centerX, centerY);
    return;
  }

  int split = -1;
  for (size_t i = 0; i < text.length() && i <= perLine; i++) {
    if (text[i] == ' ') split = i;
  }
  if (split <= 0) split = perLine;

  String first = text.substring(0, split);
  String second = text.substring(split);
  second.trim();
  if (second.length() > perLine) second = second.substring(0, perLine);

  display.drawString(first, centerX, centerY - 6);
  display.drawString(second, centerX, centerY + 6);
}

void drawTile(const BoardConfig &config, int index, bool pressed, bool failed) {
  const SoundButton &button = config.buttons[index];
  const int x = tileX(index);
  const int y = tileY(index);

  uint32_t fill = dim(button.color, pressed ? 0.85f : 0.28f);
  if (failed) fill = 0x7A2123;

  display.fillRoundRect(x, y, kTileW, kTileH, 8, fill);
  display.drawRoundRect(x, y, kTileW, kTileH, 8, button.color);

  display.setTextColor(kTextColor);
  display.setTextSize(1);
  drawLabel(button.name, x + kTileW / 2, y + kTileH / 2, kTileW - 8);
}

}  // namespace

void uiBegin() {
  display.init();
  // LovyanGFX rotation: 0/1/2/3 = 0°/90°/180°/270°, and 4/5/6/7 are the same
  // four angles with a mirror added on top. Back to the original value while
  // the bus/color/backlight fixes are verified in isolation - tune this
  // separately once the image itself is stable.
  display.setRotation(1);  // landscape, 320x240
  display.setBrightness(200);
  display.fillScreen(kBgColor);
}

void uiShowStatus(const char *title, const String &detail) {
  display.fillScreen(kBgColor);

  display.setTextDatum(middle_center);
  display.setTextColor(kTextColor);
  display.setTextSize(2);
  display.drawString(title, kScreenW / 2, kScreenH / 2 - 14);

  display.setTextSize(1);
  display.setTextColor(kMutedColor);
  display.drawString(detail, kScreenW / 2, kScreenH / 2 + 16);
}

void uiShowSetupPortal(const String &apName) {
  display.fillScreen(kBgColor);

  display.setTextDatum(top_center);
  display.setTextColor(kTextColor);
  display.setTextSize(2);
  display.drawString("Wi-Fi setup", kScreenW / 2, 24);

  display.setTextSize(1);
  display.setTextColor(kMutedColor);
  display.drawString("On your phone, join this network:", kScreenW / 2, 66);

  display.setTextColor(kTextColor);
  display.setTextSize(2);
  display.drawString(apName, kScreenW / 2, 92);

  display.setTextSize(1);
  display.setTextColor(kMutedColor);
  display.drawString("Password: " + String(kSetupApPassword), kScreenW / 2, 126);
  display.drawString("Then pick your Wi-Fi in the page that opens.", kScreenW / 2, 156);
}

void uiShowPairing(const String &pairingCode) {
  display.fillScreen(kBgColor);

  display.setTextDatum(top_left);
  display.setTextColor(kTextColor);
  display.setTextSize(2);
  display.drawString("Pair this", 16, 28);
  display.drawString("Gooseboard", 16, 50);

  display.setTextSize(1);
  display.setTextColor(kMutedColor);
  display.drawString("Scan the code, or enter", 16, 90);
  display.drawString("this at the portal:", 16, 104);

  display.setTextColor(kTextColor);
  display.setTextSize(3);
  display.drawString(pairingCode, 16, 128);

  display.setTextSize(1);
  display.setTextColor(kMutedColor);
  display.drawString(String(GOOSEBOARD_PORTAL_BASE).substring(8), 16, 172);

  // Smallest QR version the URL fits in, so its modules stay as large as
  // possible on a 240px-tall screen.
  const String url = pairingUrl(pairingCode);
  const int qrArea = 132;
  const int qrLeft = kScreenW - qrArea - 16;
  const int qrTop = (kScreenH - qrArea) / 2;

  for (uint8_t version = 3; version <= 10; version++) {
    std::vector<uint8_t> buffer(qrcode_getBufferSize(version));
    QRCode qrcode;

    if (qrcode_initText(&qrcode, buffer.data(), version, ECC_LOW, url.c_str()) != 0) {
      continue;
    }

    const int scale = qrArea / qrcode.size;
    const int rendered = scale * qrcode.size;
    const int originX = qrLeft + (qrArea - rendered) / 2;
    const int originY = qrTop + (qrArea - rendered) / 2;

    display.fillRect(originX - 4, originY - 4, rendered + 8, rendered + 8, 0xFFFFFF);
    for (uint8_t y = 0; y < qrcode.size; y++) {
      for (uint8_t x = 0; x < qrcode.size; x++) {
        if (qrcode_getModule(&qrcode, x, y)) {
          display.fillRect(originX + x * scale, originY + y * scale, scale, scale, 0x000000);
        }
      }
    }
    return;
  }

  display.setTextDatum(middle_center);
  display.setTextColor(kMutedColor);
  display.drawString("(QR too large)", qrLeft + qrArea / 2, qrTop + qrArea / 2);
}

void uiShowBoard(const BoardConfig &config) {
  display.fillScreen(kBgColor);

  if (config.count == 0) {
    uiShowStatus("No sounds yet", "Add some in the web portal");
    return;
  }

  for (size_t i = 0; i < config.count; i++) {
    drawTile(config, i, false, false);
  }
}

int uiButtonAt(const BoardConfig &config, int x, int y) {
  for (size_t i = 0; i < config.count; i++) {
    const int left = tileX(i);
    const int top = tileY(i);
    if (x >= left && x < left + kTileW && y >= top && y < top + kTileH) {
      return (int)i;
    }
  }
  return -1;
}

void uiPressButton(const BoardConfig &config, int index) {
  if (index < 0 || (size_t)index >= config.count) return;
  drawTile(config, index, true, false);
}

void uiFinishButton(const BoardConfig &config, int index, bool failed) {
  if (index < 0 || (size_t)index >= config.count) return;

  if (failed) {
    drawTile(config, index, false, true);
    delay(500);
  }
  drawTile(config, index, false, false);
}
