
#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "firefly-display.h"
#include "firefly-scene.h"


#include <string.h>

#define DISPLAY_BUS        (FfxDisplaySpiBus2)
#define PIN_DISPLAY_DC     (4)
#define PIN_DISPLAY_RESET  (5)


static TaskHandle_t taskAppHandle = NULL;

static void delay(uint32_t duration) {
    vTaskDelay((duration + portTICK_PERIOD_MS - 1) / portTICK_PERIOD_MS);
}

void renderScene(uint8_t *fragment, uint32_t y0, void *context) {
    FfxScene scene = context;
    ffx_scene_render(scene, fragment, y0, FfxDisplayFragmentHeight);
}

void bounce(FfxScene scene, FfxNode node, FfxSceneActionStop stopType) {
  FfxPoint point;
  point.x = rand() % 256;
  point.y = rand() % 256;
  uint32_t duration = 5000 + (rand() % 500);

  ffx_scene_nodeAnimatePosition(scene, node, point, duration,
    FfxCurveLinear, bounce);

  uint32_t h = rand() % 360;
  color_ffxt color = ffx_color_hsv(h, 63, 63, 63);
  ffx_scene_boxAnimateColor(scene, node, color, duration,
    FfxCurveLinear, NULL);
}

void taskAppFunc(void *pvParameter) {
  FfxScene scene = ffx_scene_init(128);
  FfxNode root = ffx_scene_root(scene);

  FfxNode fill = ffx_scene_createFill(scene, ffx_color_rgb(0x66, 0x44, 0xaa, 0x3c));
  ffx_scene_appendChild(root, fill);

  for (int i = 0; i < 1; i++) {
    FfxSize size = { .width = 20, .height = 20 };
    uint32_t h = rand() % 360;
    FfxNode box = ffx_scene_createBox(scene, size, ffx_color_hsv(h, 63, 63, 63));
    ffx_scene_appendChild(root, box);

    bounce(scene, box, FfxSceneActionStopNormal);
  }

  printf("[app] init scene\n");
  ffx_scene_dump(scene);

  FfxDisplayContext display = ffx_display_init(DISPLAY_BUS, PIN_DISPLAY_DC,
    PIN_DISPLAY_RESET, FfxDisplayRotationRibbonRight, renderScene, scene);
  printf("[app] init display\n");

  TickType_t lastFrameTime = xTaskGetTickCount();

  while (1) {
    uint32_t frameDone = ffx_display_renderFragment(display);
    if (frameDone) {
      ffx_scene_sequence(scene);

      BaseType_t didDelay = xTaskDelayUntil(&lastFrameTime, 1000 / 60);
      if (didDelay == pdFALSE) {
        delay(1);
        lastFrameTime = xTaskGetTickCount();
      }

    }
  }
}

void app_main(void) {
  BaseType_t status = xTaskCreatePinnedToCore(&taskAppFunc, "app",
      8192 * 8, NULL, 1, &taskAppHandle, 0);
  printf("[main] init app task: status=%d\n", status);
  assert(taskAppHandle != NULL);

  while (1) { delay(1000); }
}
