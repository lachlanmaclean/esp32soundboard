#pragma once

// LovyanGFX wiring for the ESP32-2432S028R "Cheap Yellow Display": ST7789
// panel on HSPI, XPT2046 resistive touch on its own VSPI bus, PWM backlight
// on GPIO21. Some batches of this board ship an ILI9341 instead despite
// having the same model number - if colors/behavior look wrong, that's the
// first thing to try swapping back.

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class GooseboardDisplay : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 _panel;
  lgfx::Bus_SPI _bus;
  lgfx::Light_PWM _light;
  lgfx::Touch_XPT2046 _touch;

public:
  GooseboardDisplay() {
    {
      auto cfg = _bus.config();
      cfg.spi_host = HSPI_HOST;
      cfg.spi_mode = 0;
      // 40MHz can be unstable on this board's unshielded flying leads and
      // shows up as garbled/scrambled pixels rather than a clean image.
      cfg.freq_write = 27000000;
      cfg.freq_read = 16000000;
      cfg.spi_3wire = false;
      cfg.use_lock = true;
      cfg.dma_channel = SPI_DMA_CH_AUTO;
      cfg.pin_sclk = 14;
      cfg.pin_mosi = 13;
      cfg.pin_miso = 12;
      cfg.pin_dc = 2;
      _bus.config(cfg);
      _panel.setBus(&_bus);
    }

    {
      auto cfg = _panel.config();
      cfg.pin_cs = 15;
      cfg.pin_rst = -1;
      cfg.pin_busy = -1;
      cfg.panel_width = 240;
      cfg.panel_height = 320;
      cfg.offset_x = 0;
      cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits = 1;
      cfg.readable = true;
      cfg.invert = true;
      cfg.rgb_order = false;
      cfg.dlen_16bit = false;
      cfg.bus_shared = false;
      _panel.config(cfg);
    }

    {
      auto cfg = _light.config();
      cfg.pin_bl = 21;
      cfg.invert = false;
      // 44100Hz is a common copy-pasted value, but ESP32's LEDC PWM isn't
      // reliably stable there and it shows up as visible backlight flicker.
      cfg.freq = 1000;
      cfg.pwm_channel = 7;
      _light.config(cfg);
      _panel.setLight(&_light);
    }

    {
      // Resistive panels vary unit to unit; these are typical for this board.
      // y_min/y_max are swapped (not just different values) to invert the
      // touch panel's Y axis, which was mounted flipped relative to the
      // display on this unit - touches near the top were reporting as if
      // near the bottom.
      auto cfg = _touch.config();
      cfg.x_min = 300;
      cfg.x_max = 3900;
      cfg.y_min = 3700;
      cfg.y_max = 200;
      cfg.pin_int = 36;
      cfg.bus_shared = false;
      cfg.offset_rotation = 0;
      cfg.spi_host = VSPI_HOST;
      cfg.freq = 1000000;
      cfg.pin_sclk = 25;
      cfg.pin_mosi = 32;
      cfg.pin_miso = 39;
      cfg.pin_cs = 33;
      _touch.config(cfg);
      _panel.setTouch(&_touch);
    }

    setPanel(&_panel);
  }
};

extern GooseboardDisplay display;
