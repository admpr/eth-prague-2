import assert from "node:assert/strict";
import test from "node:test";
import { shouldRequestDeviceForReconnect } from "./FireflyConnectionControl";

test("uses the Bluetooth chooser only for user-triggered reconnects", () => {
  assert.equal(shouldRequestDeviceForReconnect("auto"), false);
  assert.equal(shouldRequestDeviceForReconnect("manual"), true);
});
