import assert from "node:assert/strict";
import test from "node:test";
import { createAgentPermissionStateRequestGate } from "./useAgentPermissionState";

test("allows employee state updates after a Strict Mode effect remount", () => {
  const gate = createAgentPermissionStateRequestGate();
  const firstRequest = gate.nextRequestId();

  assert.equal(gate.canUpdate(firstRequest), true);

  gate.markUnmounted();
  assert.equal(gate.canUpdate(firstRequest), false);

  gate.markMounted();
  const replayedRequest = gate.nextRequestId();

  assert.equal(gate.canUpdate(replayedRequest), true);
});
